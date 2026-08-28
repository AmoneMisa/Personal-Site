import { parseDocument } from "yaml";

// A GitHub Actions workflow linter. Deliberately a pure function over a string so
// it can be unit tested without a browser, a network call or a Vue runtime.
//
// This checks workflow *structure* against documented Actions semantics. It is not
// natural-language understanding, so it does not belong in @whiteslove/parsing-lexicon
// (see AGENTS.md §8) — it is website tooling that Personal Site owns.

export type WorkflowIssueLevel = "error" | "warning" | "info";

export interface WorkflowIssue {
  level: WorkflowIssueLevel;
  /** Stable machine-readable id, useful for tests and for filtering in the UI. */
  code: string;
  message: string;
  /** 1-based, when the parser can attribute the problem to a position. */
  line?: number;
  col?: number;
  /** Dotted path into the document, e.g. `jobs.build.steps[0]`. */
  path?: string;
}

export interface WorkflowValidationResult {
  issues: WorkflowIssue[];
  /** False when the document could not be parsed at all. */
  parsed: boolean;
  jobCount: number;
  stepCount: number;
}

// Documented top-level workflow keys. Anything else is a typo or unsupported.
const KNOWN_TOP_LEVEL_KEYS = new Set([
  "name", "on", "permissions", "env", "defaults", "concurrency", "jobs", "run-name",
]);

// Refs that move. Pinning to these means a third party can change what executes
// in your pipeline after review, which is the standard supply-chain warning.
const MUTABLE_REFS = new Set(["main", "master", "latest", "HEAD", "develop", "dev"]);

// Actions published by GitHub itself; a floating major tag on these is common
// practice and noisy to flag at the same severity as a third-party action.
const FIRST_PARTY_ACTION_OWNERS = new Set(["actions", "github"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Detects credentials written inline instead of referenced via `secrets.*`. */
function looksLikeHardcodedSecret(value: string): boolean {
  const trimmed = value.trim();
  // Anything routed through an expression is fine — that is the correct pattern.
  if (trimmed.includes("${{")) return false;
  return (
    /^gh[pousr]_[A-Za-z0-9]{16,}$/.test(trimmed)            // GitHub tokens
    || /^github_pat_[A-Za-z0-9_]{20,}$/.test(trimmed)        // fine-grained PAT
    || /^AKIA[0-9A-Z]{16}$/.test(trimmed)                    // AWS access key id
    || /^xox[baprs]-[A-Za-z0-9-]{10,}$/.test(trimmed)        // Slack tokens
    || /^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(trimmed)   // PEM private keys
  );
}

/** Walks `env:` maps looking for inline credentials. */
function checkEnvForSecrets(env: unknown, path: string, issues: WorkflowIssue[]) {
  if (!isPlainObject(env)) return;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && looksLikeHardcodedSecret(value)) {
      issues.push({
        level: "error",
        code: "hardcoded-secret",
        message: `\`${path}.${key}\` looks like a hardcoded credential. Use \`\${{ secrets.NAME }}\` instead.`,
        path: `${path}.${key}`,
      });
    }
  }
}

/** Flags `uses:` refs that are not pinned to something immutable. */
function checkUsesPinning(uses: string, path: string, issues: WorkflowIssue[]) {
  // Local (./path) and container (docker://) actions are not version-pinned refs.
  if (uses.startsWith("./") || uses.startsWith("docker://")) return;

  const at = uses.lastIndexOf("@");
  if (at === -1) {
    issues.push({
      level: "error",
      code: "uses-unversioned",
      message: `\`${uses}\` has no version ref. Pin it with \`@<tag>\` or, preferably, a full commit SHA.`,
      path,
    });
    return;
  }

  const ref = uses.slice(at + 1);
  const owner = uses.slice(0, uses.indexOf("/")).toLowerCase();
  const firstParty = FIRST_PARTY_ACTION_OWNERS.has(owner);

  if (MUTABLE_REFS.has(ref)) {
    issues.push({
      level: "error",
      code: "uses-mutable-ref",
      message: `\`${uses}\` is pinned to the moving ref \`${ref}\`. Whatever that branch points at will run in your pipeline — pin a tag or a commit SHA.`,
      path,
    });
    return;
  }

  // A 40-char hex ref is a full commit SHA: the only genuinely immutable pin.
  if (/^[0-9a-f]{40}$/i.test(ref)) return;

  if (!firstParty) {
    issues.push({
      level: "warning",
      code: "uses-unpinned-tag",
      message: `\`${uses}\` is pinned to the tag \`${ref}\`, which the publisher can move. Pin a full commit SHA for third-party actions.`,
      path,
    });
  }
}

/** Reports `needs:` entries that name a job that does not exist. */
function checkNeedsReferences(
  jobId: string,
  needs: string[],
  jobIds: Set<string>,
  issues: WorkflowIssue[],
) {
  for (const dependency of needs) {
    if (dependency === jobId) {
      issues.push({
        level: "error",
        code: "needs-self",
        message: `Job \`${jobId}\` lists itself in \`needs\`, so it can never start.`,
        path: `jobs.${jobId}.needs`,
      });
      continue;
    }
    if (!jobIds.has(dependency)) {
      issues.push({
        level: "error",
        code: "needs-unknown-job",
        message: `Job \`${jobId}\` needs \`${dependency}\`, which is not defined in this workflow.`,
        path: `jobs.${jobId}.needs`,
      });
    }
  }
}

/**
 * Depth-first cycle detection over the `needs` graph. A cycle deadlocks the whole
 * run, and GitHub reports it only at dispatch time, so it is worth catching here.
 */
function findNeedsCycle(graph: Map<string, string[]>): string[] | null {
  const VISITING = 1;
  const DONE = 2;
  const state = new Map<string, number>();
  const stack: string[] = [];

  function walk(node: string): string[] | null {
    if (state.get(node) === DONE) return null;
    if (state.get(node) === VISITING) {
      // Trim the stack down to the cycle itself for a readable message.
      return [...stack.slice(stack.indexOf(node)), node];
    }
    state.set(node, VISITING);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue; // unknown ids already reported separately
      const cycle = walk(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, DONE);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = walk(node);
    if (cycle) return cycle;
  }
  return null;
}

function normalizeNeeds(raw: unknown): string[] {
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  return [];
}

function validateSteps(jobId: string, steps: unknown[], issues: WorkflowIssue[]): number {
  steps.forEach((step, index) => {
    const path = `jobs.${jobId}.steps[${index}]`;
    if (!isPlainObject(step)) {
      issues.push({ level: "error", code: "step-not-mapping", message: `${path} is not a mapping.`, path });
      return;
    }

    const hasUses = typeof step.uses === "string" && step.uses.trim() !== "";
    const hasRun = typeof step.run === "string" && step.run.trim() !== "";

    if (hasUses && hasRun) {
      issues.push({
        level: "error",
        code: "step-uses-and-run",
        message: `${path} sets both \`uses\` and \`run\`. A step can only be one or the other.`,
        path,
      });
    } else if (!hasUses && !hasRun) {
      issues.push({
        level: "error",
        code: "step-empty",
        message: `${path} has neither \`uses\` nor \`run\`, so it does nothing.`,
        path,
      });
    }

    if (hasUses) checkUsesPinning(step.uses as string, `${path}.uses`, issues);
    if (hasRun && step.shell === undefined && typeof step.run === "string" && step.run.includes("\r\n")) {
      issues.push({
        level: "info",
        code: "step-crlf",
        message: `${path} has CRLF line endings in \`run\`, which can break shell scripts on Linux runners.`,
        path,
      });
    }
    checkEnvForSecrets(step.env, `${path}.env`, issues);
  });
  return steps.length;
}

export function validateWorkflow(source: string): WorkflowValidationResult {
  const issues: WorkflowIssue[] = [];
  const empty: WorkflowValidationResult = { issues, parsed: false, jobCount: 0, stepCount: 0 };

  if (!source.trim()) {
    issues.push({ level: "error", code: "empty-document", message: "The workflow is empty." });
    return empty;
  }

  const doc = parseDocument(source);

  for (const error of doc.errors) {
    const [start] = error.linePos ?? [];
    issues.push({
      level: "error",
      code: "yaml-syntax",
      // The library appends its own multi-line excerpt; the first line is the message.
      message: error.message.split("\n")[0]!,
      line: start?.line,
      col: start?.col,
    });
  }
  if (doc.errors.length) return empty;

  for (const warning of doc.warnings) {
    const [start] = warning.linePos ?? [];
    issues.push({
      level: "warning",
      code: "yaml-warning",
      message: warning.message.split("\n")[0]!,
      line: start?.line,
      col: start?.col,
    });
  }

  const root = doc.toJS();
  if (!isPlainObject(root)) {
    issues.push({ level: "error", code: "root-not-mapping", message: "A workflow must be a YAML mapping at the top level." });
    return empty;
  }

  // `on` is required. Note this relies on YAML 1.2 parsing, where `on` stays the
  // string "on"; under YAML 1.1 it would have been coerced to boolean true.
  const trigger = root.on ?? (root as Record<string, unknown>)["true"];
  if (root.on === undefined && (root as Record<string, unknown>)["true"] !== undefined) {
    issues.push({
      level: "error",
      code: "on-parsed-as-boolean",
      message: "`on` was parsed as the boolean `true`. Quote it as `\"on\":` so it stays a key.",
      path: "on",
    });
  } else if (trigger === undefined || trigger === null) {
    issues.push({
      level: "error",
      code: "missing-on",
      message: "Missing `on`. A workflow needs at least one trigger.",
      path: "on",
    });
  }

  if (root.name === undefined) {
    issues.push({
      level: "info",
      code: "missing-name",
      message: "No `name`. GitHub will fall back to the file path in the Actions UI.",
      path: "name",
    });
  }

  if (root.permissions === undefined) {
    issues.push({
      level: "warning",
      code: "missing-permissions",
      message: "No top-level `permissions`. The workflow inherits the repository default, which is often broader than it needs. Declare the narrowest set it requires.",
      path: "permissions",
    });
  }

  for (const key of Object.keys(root)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key) && key !== "true") {
      issues.push({
        level: "warning",
        code: "unknown-top-level-key",
        message: `\`${key}\` is not a recognised top-level workflow key.`,
        path: key,
      });
    }
  }

  checkEnvForSecrets(root.env, "env", issues);

  const jobs = root.jobs;
  if (!isPlainObject(jobs)) {
    issues.push({ level: "error", code: "missing-jobs", message: "Missing `jobs`. A workflow needs at least one job.", path: "jobs" });
    return { issues, parsed: true, jobCount: 0, stepCount: 0 };
  }

  const jobEntries = Object.entries(jobs);
  if (!jobEntries.length) {
    issues.push({ level: "error", code: "empty-jobs", message: "`jobs` is empty.", path: "jobs" });
    return { issues, parsed: true, jobCount: 0, stepCount: 0 };
  }

  const jobIds = new Set(jobEntries.map(([id]) => id));
  const needsGraph = new Map<string, string[]>();
  let stepCount = 0;

  for (const [jobId, rawJob] of jobEntries) {
    const path = `jobs.${jobId}`;
    if (!isPlainObject(rawJob)) {
      issues.push({ level: "error", code: "job-not-mapping", message: `${path} is not a mapping.`, path });
      continue;
    }

    const needs = normalizeNeeds(rawJob.needs);
    needsGraph.set(jobId, needs);
    checkNeedsReferences(jobId, needs, jobIds, issues);
    checkEnvForSecrets(rawJob.env, `${path}.env`, issues);

    // A job either runs steps on a runner, or delegates to a reusable workflow.
    const callsReusableWorkflow = typeof rawJob.uses === "string";
    if (callsReusableWorkflow) {
      if (rawJob.steps !== undefined) {
        issues.push({
          level: "error",
          code: "job-uses-with-steps",
          message: `${path} calls a reusable workflow with \`uses\`, so it cannot also define \`steps\`.`,
          path,
        });
      }
      checkUsesPinning(rawJob.uses as string, `${path}.uses`, issues);
      continue;
    }

    if (rawJob["runs-on"] === undefined) {
      issues.push({
        level: "error",
        code: "missing-runs-on",
        message: `${path} has no \`runs-on\`, and does not call a reusable workflow with \`uses\`.`,
        path,
      });
    }

    if (!Array.isArray(rawJob.steps)) {
      issues.push({
        level: "error",
        code: "missing-steps",
        message: `${path} has no \`steps\`.`,
        path,
      });
      continue;
    }
    if (!rawJob.steps.length) {
      issues.push({ level: "error", code: "empty-steps", message: `${path} has an empty \`steps\` list.`, path });
      continue;
    }
    stepCount += validateSteps(jobId, rawJob.steps, issues);
  }

  const cycle = findNeedsCycle(needsGraph);
  if (cycle) {
    issues.push({
      level: "error",
      code: "needs-cycle",
      message: `Circular \`needs\` dependency: ${cycle.join(" → ")}. None of these jobs can ever start.`,
      path: "jobs",
    });
  }

  return { issues, parsed: true, jobCount: jobEntries.length, stepCount };
}

/** Convenience summary for rendering a status line. */
export function summarizeIssues(issues: WorkflowIssue[]) {
  return {
    errors: issues.filter((issue) => issue.level === "error").length,
    warnings: issues.filter((issue) => issue.level === "warning").length,
    infos: issues.filter((issue) => issue.level === "info").length,
  };
}
