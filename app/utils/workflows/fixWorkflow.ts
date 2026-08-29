import { parseDocument, isMap, isPair, isScalar, isSeq, type YAMLMap } from "yaml";

// Auto-fixes only what is mechanically unambiguous. Everything else (which
// commit SHA to pin, what permissions a job actually needs, which of uses/run
// a broken step meant) is a real judgment call and stays report-only — see
// validateWorkflow.ts's WorkflowIssue for the full list and why.
export type WorkflowFixCode =
  | "on-parsed-as-boolean"
  | "missing-name"
  | "hardcoded-secret"
  | "formatting";

export interface WorkflowFixResult {
  /** True if anything actually changed (including pure formatting). */
  changed: boolean;
  fixed: string;
  applied: WorkflowFixCode[];
}

function secretKeyFor(envKey: string): string {
  // GitHub secret names are conventionally SCREAMING_SNAKE_CASE; keep the
  // original key's characters but normalize case and separators to match.
  return envKey.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
}

function looksLikeHardcodedSecret(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.includes("${{")) return false;
  return (
    /^gh[pousr]_[A-Za-z0-9]{16,}$/.test(trimmed)
    || /^github_pat_[A-Za-z0-9_]{20,}$/.test(trimmed)
    || /^AKIA[0-9A-Z]{16}$/.test(trimmed)
    || /^xox[baprs]-[A-Za-z0-9-]{10,}$/.test(trimmed)
    || /^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(trimmed)
  );
}

/** Walks every `env:` map in the document (root, per-job, per-step) and fixes leaks. */
function fixSecretsInEnvMaps(root: YAMLMap, applied: Set<WorkflowFixCode>) {
  function visitEnv(map: YAMLMap) {
    for (const item of map.items) {
      if (!isPair(item) || !isScalar(item.value) || typeof item.value.value !== "string") continue;
      if (!looksLikeHardcodedSecret(item.value.value)) continue;
      const key = isScalar(item.key) ? String(item.key.value) : "SECRET";
      item.value.value = `\${{ secrets.${secretKeyFor(key)} }}`;
      applied.add("hardcoded-secret");
    }
  }

  // `env:` can appear at the workflow root, on any job, or on any step — and
  // steps live in a sequence, not a map, so this has to descend into both.
  function walk(node: unknown) {
    if (isSeq(node)) {
      for (const item of node.items) walk(item);
      return;
    }
    if (!isMap(node)) return;
    for (const item of node.items) {
      if (!isPair(item)) continue;
      if (isScalar(item.key) && item.key.value === "env" && isMap(item.value)) {
        visitEnv(item.value);
      } else {
        walk(item.value);
      }
    }
  }

  walk(root);
}

/**
 * Applies every safe fix and re-serializes. Re-serializing through the `yaml`
 * library always normalizes indentation to 2 spaces, strips trailing
 * whitespace, and collapses redundant blank lines — that happens for free on
 * every call, even one that fixes nothing else, which is why "formatting" can
 * appear in `applied` on its own.
 */
export function fixWorkflow(source: string): WorkflowFixResult {
  const applied = new Set<WorkflowFixCode>();
  const doc = parseDocument(source);

  // A document with real syntax errors can't be safely restructured.
  if (doc.errors.length || !isMap(doc.contents)) {
    return { changed: false, fixed: source, applied: [] };
  }

  const root = doc.contents;

  // `on:` parsed as the boolean `true` under YAML 1.1-style coercion.
  const onPair = root.items.find((item) => isPair(item) && isScalar(item.key) && item.key.value === true);
  const hasStringOn = root.items.some((item) => isPair(item) && isScalar(item.key) && item.key.value === "on");
  if (onPair && isPair(onPair) && isScalar(onPair.key) && !hasStringOn) {
    onPair.key.value = "on";
    applied.add("on-parsed-as-boolean");
  }

  const hasName = root.items.some((item) => isPair(item) && isScalar(item.key) && item.key.value === "name");
  if (!hasName) {
    root.items.unshift(doc.createPair("name", "CI"));
    applied.add("missing-name");
  }

  fixSecretsInEnvMaps(root, applied);

  // No lineWidth override: the default preserves human-authored folded/wrapped
  // scalars (e.g. `if: >-` conditions, multi-line `run:` blocks) close to their
  // original shape. Forcing lineWidth: 0 un-wraps them onto one long line each,
  // which is a much bigger stylistic change than "fix the spacing" implies.
  const fixed = doc.toString();
  const formattingChanged = fixed !== source;
  if (formattingChanged && applied.size === 0) applied.add("formatting");

  return { changed: formattingChanged, fixed, applied: [...applied] };
}
