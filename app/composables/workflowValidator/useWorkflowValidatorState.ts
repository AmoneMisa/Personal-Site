import { computed, ref } from "vue";
import {
  summarizeIssues,
  validateWorkflow,
  type WorkflowIssueLevel,
} from "~/utils/workflows/validateWorkflow";

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

  function loadSample() {
    source.value = SAMPLE;
    fileName.value = "";
    loadError.value = "";
  }

  function clear() {
    source.value = "";
    fileName.value = "";
    loadError.value = "";
  }

  async function loadFile(file: File | null | undefined) {
    if (!file) return;
    loadError.value = "";
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
    loadSample,
    loadFile,
    clear,
  };
}
