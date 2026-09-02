<script setup lang="ts">
import { ref } from "vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";
import { useWorkflowValidatorState } from "~/composables/workflowValidator/useWorkflowValidatorState";
import type { WorkflowIssueLevel } from "~/utils/workflows/validateWorkflow";

const { t } = useI18n();

useServiceSeo("workflowValidator");
const ui = proxyRefs(useWorkflowValidatorState());

const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

const LEVEL_ICONS: Record<WorkflowIssueLevel, string> = {
  error: "i-lucide-circle-x",
  warning: "i-lucide-triangle-alert",
  info: "i-lucide-info",
};

const FILTERS: Array<{ value: WorkflowIssueLevel | "all"; labelKey: string }> = [
  { value: "all", labelKey: "filterAll" },
  { value: "error", labelKey: "filterErrors" },
  { value: "warning", labelKey: "filterWarnings" },
  { value: "info", labelKey: "filterInfo" },
];

// Mirrors the codes fixWorkflow.ts actually handles (WorkflowFixCode, minus
// "formatting" which isn't a listed issue) — only used here to badge which
// issues below the Fix button will resolve.
const FIXABLE_CODES = new Set(["on-parsed-as-boolean", "missing-name", "hardcoded-secret"]);

function onDrop(event: DragEvent) {
  dragging.value = false;
  void ui.loadFile(event.dataTransfer?.files?.[0]);
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement;
  void ui.loadFile(input.files?.[0]);
  // Allow re-picking the same file after an edit.
  input.value = "";
}
</script>

<template>
  <u-container class="wfv">
    <service-page-header
      backdrop="treasure"
      title="services.workflowValidator.title"
      headline="services.workflowValidator.headline"
      description="services.workflowValidator.subtitle"
    />

    <section class="wfv__card">
      <div class="wfv__toolbar">
        <u-button type="button" size="sm" color="neutral" variant="outline" icon="i-lucide-upload" @click="fileInput?.click()">
          {{ t("services.workflowValidator.controls.upload") }}
        </u-button>
        <u-button type="button" size="sm" color="neutral" variant="outline" icon="i-lucide-sparkles" @click="ui.loadSample()">
          {{ t("services.workflowValidator.controls.sample") }}
        </u-button>
        <u-button v-if="ui.hasInput" type="button" size="sm" color="neutral" variant="outline" icon="i-lucide-eraser" @click="ui.clear()">
          {{ t("services.workflowValidator.controls.clear") }}
        </u-button>
        <u-button
          v-if="ui.canFix"
          type="button"
          size="sm"
          color="primary"
          variant="solid"
          icon="i-lucide-wand-sparkles"
          @click="ui.applyFix()"
        >
          {{ t("services.workflowValidator.controls.fix") }}
        </u-button>
        <span v-if="ui.fileName" class="wfv__filename">{{ ui.fileName }}</span>
        <input
          ref="fileInput"
          type="file"
          accept=".yml,.yaml,text/yaml,application/x-yaml"
          class="wfv__file-input"
          @change="onPick"
        >
      </div>

      <div class="wfv__panes">
        <div
          class="wfv__pane wfv__pane_editor"
          :class="{ 'wfv__pane_dragging': dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <label class="wfv__pane-title" for="wfv-source">{{ t("services.workflowValidator.panel.input") }}</label>
          <textarea
            id="wfv-source"
            v-model="ui.source"
            class="wfv__editor"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            :placeholder="t('services.workflowValidator.panel.placeholder')"
          />
        </div>

        <div class="wfv__pane">
          <div class="wfv__pane-head">
            <span class="wfv__pane-title">{{ t("services.workflowValidator.panel.results") }}</span>
            <div v-if="ui.hasInput && ui.result.parsed" class="wfv__filters" role="group" :aria-label="t('services.workflowValidator.panel.results')">
              <button
                v-for="filter in FILTERS"
                :key="filter.value"
                type="button"
                :class="{ active: ui.levelFilter === filter.value }"
                :aria-pressed="ui.levelFilter === filter.value"
                @click="ui.levelFilter = filter.value"
              >{{ t(`services.workflowValidator.controls.${filter.labelKey}`) }}</button>
            </div>
          </div>

          <p v-if="ui.tooLarge" class="wfv__state wfv__state_error">
            {{ t("services.workflowValidator.messages.tooLarge") }}
          </p>
          <p v-else-if="ui.loadError" class="wfv__state wfv__state_error">
            {{ t(`services.workflowValidator.messages.${ui.loadError}`) }}
          </p>
          <p v-else-if="!ui.hasInput" class="wfv__state">
            {{ t("services.workflowValidator.messages.empty") }}
          </p>
          <p v-else-if="ui.isClean" class="wfv__state wfv__state_ok">
            <u-icon name="i-lucide-circle-check" />
            {{ t("services.workflowValidator.messages.valid", { jobs: ui.result.jobCount, steps: ui.result.stepCount }) }}
          </p>

          <template v-else>
            <p v-if="ui.lastAppliedFixes.length" class="wfv__state wfv__state_fixed">
              <u-icon name="i-lucide-wand-sparkles" />
              {{ t("services.workflowValidator.messages.fixed", { n: ui.lastAppliedFixes.length }) }}
            </p>
            <p class="wfv__summary">
              <span v-if="ui.summary.errors" class="wfv__count wfv__count_error">{{ t("services.workflowValidator.messages.errors", { n: ui.summary.errors }) }}</span>
              <span v-if="ui.summary.warnings" class="wfv__count wfv__count_warning">{{ t("services.workflowValidator.messages.warnings", { n: ui.summary.warnings }) }}</span>
              <span v-if="ui.summary.infos" class="wfv__count wfv__count_info">{{ t("services.workflowValidator.messages.infos", { n: ui.summary.infos }) }}</span>
            </p>

            <ul class="wfv__issues">
              <li v-for="(issue, index) in ui.visibleIssues" :key="`${issue.code}-${index}`" class="wfv__issue" :class="`wfv__issue_${issue.level}`">
                <u-icon :name="LEVEL_ICONS[issue.level]" class="wfv__issue-icon" />
                <div class="wfv__issue-body">
                  <p class="wfv__issue-message">{{ issue.message }}</p>
                  <p class="wfv__issue-meta">
                    <span v-if="issue.line" class="wfv__issue-loc">{{ t("services.workflowValidator.messages.at", { line: issue.line, col: issue.col }) }}</span>
                    <span v-else-if="issue.path" class="wfv__issue-loc">{{ issue.path }}</span>
                    <code class="wfv__issue-code">{{ issue.code }}</code>
                    <span v-if="FIXABLE_CODES.has(issue.code)" class="wfv__issue-fixable">{{ t("services.workflowValidator.messages.fixable") }}</span>
                  </p>
                </div>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </section>
  </u-container>
</template>

<style scoped lang="scss">
@use "../../../assets/css/mixins/breakpoints" as *;

.wfv { padding-top: 24px; padding-bottom: 96px; }

.wfv__card {
  margin-top: 18px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.wfv__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.wfv__filename { color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wfv__file-input { display: none; }

.wfv__panes {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-width: 0;
}
@include bp-down(lg) {
  .wfv__panes { grid-template-columns: 1fr; }
}

.wfv__pane { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.wfv__pane_editor { border-radius: 8px; transition: outline-color 120ms ease; outline: 2px dashed transparent; outline-offset: 4px; }
.wfv__pane_dragging { outline-color: var(--accent-pink, #e0679a); }

.wfv__pane-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.wfv__pane-title { color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }

.wfv__filters { display: flex; gap: 4px; }
.wfv__filters button {
  padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px;
  background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer;
}
.wfv__filters button.active { border-color: var(--accent-pink, #e0679a); color: var(--text-primary); }

.wfv__editor {
  width: 100%;
  min-height: 420px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  resize: vertical;
  tab-size: 2;
}
.wfv__editor:focus-visible { outline: 2px solid var(--accent-pink, #e0679a); outline-offset: -2px; }

.wfv__state { display: flex; align-items: center; gap: 8px; margin: 0; padding: 14px; border: 1px dashed var(--line); border-radius: 8px; color: var(--text-muted); font-size: 13px; }
.wfv__state_ok { border-style: solid; border-color: rgba(74, 222, 128, .5); color: #4ade80; }
.wfv__state_error { border-style: solid; border-color: rgba(239, 68, 68, .5); color: #ef4444; }
.wfv__state_fixed { border-style: solid; border-color: rgba(224, 103, 154, .5); color: var(--accent-pink, #e0679a); }

.wfv__summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; }
.wfv__count { padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.wfv__count_error { background: rgba(239, 68, 68, .16); color: #ef4444; }
.wfv__count_warning { background: rgba(250, 204, 21, .16); color: #facc15; }
.wfv__count_info { background: rgba(103, 232, 249, .16); color: #67e8f9; }

.wfv__issues { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.wfv__issue {
  display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px;
  padding: 10px 12px; border: 1px solid var(--line); border-left-width: 3px; border-radius: 8px;
  background: rgba(255, 255, 255, .02);
}
.wfv__issue_error { border-left-color: #ef4444; }
.wfv__issue_warning { border-left-color: #facc15; }
.wfv__issue_info { border-left-color: #67e8f9; }
.wfv__issue-icon { margin-top: 2px; }
.wfv__issue_error .wfv__issue-icon { color: #ef4444; }
.wfv__issue_warning .wfv__issue-icon { color: #facc15; }
.wfv__issue_info .wfv__issue-icon { color: #67e8f9; }
.wfv__issue-body { min-width: 0; }
.wfv__issue-message { margin: 0; color: var(--text-primary); font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
.wfv__issue-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 0; }
.wfv__issue-loc { color: var(--text-muted); font-size: 11.5px; overflow-wrap: anywhere; }
.wfv__issue-code { color: var(--text-muted); font-size: 11px; opacity: .75; }
.wfv__issue-fixable {
  padding: 1px 7px; border-radius: 999px; background: rgba(224, 103, 154, .16);
  color: var(--accent-pink, #e0679a); font-size: 10.5px; font-weight: 700;
}
</style>
