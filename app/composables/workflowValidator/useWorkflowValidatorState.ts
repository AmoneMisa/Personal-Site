import { computed, ref } from "vue";
import {
  summarizeIssues,
  validateWorkflow,
  type WorkflowIssueLevel,
} from "~/utils/workflows/validateWorkflow";
import { fixWorkflow, type WorkflowFixCode } from "~/utils/workflows/fixWorkflow";

const SAMPLE = `name: CI
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: some/setup-action@main
      - run: npm test
  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: placeholder
`;

// Anything much larger than a real workflow is almost certainly a mistaken paste,
// and linting it would just block the main thread.
const MAX_INPUT_BYTES = 512 * 1024;

export function useWorkflowValidatorState() {
  const source = ref("");
  const fileName = ref("");
  const loadError = ref("");
  const levelFilter = ref<WorkflowIssueLevel | "all">("all");

  const tooLarge = computed(() => source.value.length > MAX_INPUT_BYTES);

  const result = computed(() => {
    if (tooLarge.value) return { issues: [], parsed: false, jobCount: 0, stepCount: 0 };
    return validateWorkflow(source.value);
  });

  const summary = computed(() => summarizeIssues(result.value.issues));

  const visibleIssues = computed(() => (
    levelFilter.value === "all"
      ? result.value.issues
      : result.value.issues.filter((issue) => issue.level === levelFilter.value)
  ));

  const hasInput = computed(() => source.value.trim().length > 0);
  const isClean = computed(() => hasInput.value && !tooLarge.value && result.value.issues.length === 0);

  // Fixing is a dry run until applied: computed off the current source, not
  // mutating anything, so the button can be shown/labelled before it's clicked.
  const appliedFixes = ref<WorkflowFixCode[]>([]);
  // Only trust `appliedFixes` while the source still matches what Fix produced —
  // otherwise a further edit (or another Fix click with nothing left to do)
  // would leave a stale "fixed N issues" message showing.
  const appliedFixesSource = ref<string | null>(null);
  const lastAppliedFixes = computed(() => (
    appliedFixesSource.value === source.value ? appliedFixes.value : []
  ));
  const fixPreview = computed(() => {
    if (!hasInput.value || tooLarge.value || !result.value.parsed) return null;
    return fixWorkflow(source.value);
  });
  const canFix = computed(() => !!fixPreview.value?.changed);

  function applyFix() {
    const preview = fixPreview.value;
    if (!preview?.changed) return;
    source.value = preview.fixed;
    appliedFixes.value = preview.applied;
    appliedFixesSource.value = preview.fixed;
  }

  function loadSample() {
    source.value = SAMPLE;
    fileName.value = "";
    loadError.value = "";
    appliedFixesSource.value = null;
  }

  function clear() {
    source.value = "";
    fileName.value = "";
    loadError.value = "";
    appliedFixesSource.value = null;
  }

  async function loadFile(file: File | null | undefined) {
    if (!file) return;
    loadError.value = "";
    appliedFixesSource.value = null;
    if (file.size > MAX_INPUT_BYTES) {
      loadError.value = "tooLarge";
      return;
    }
    try {
      source.value = await file.text();
      fileName.value = file.name;
    } catch {
      loadError.value = "unreadable";
    }
  }

  return {
    source,
    fileName,
    loadError,
    levelFilter,
    tooLarge,
    result,
    summary,
    visibleIssues,
    hasInput,
    isClean,
    canFix,
    lastAppliedFixes,
    applyFix,
    loadSample,
    loadFile,
    clear,
  };
}
