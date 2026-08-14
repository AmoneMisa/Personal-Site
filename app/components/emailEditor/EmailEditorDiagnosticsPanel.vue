<script setup lang="ts">
import type { DiagnosticItem } from "~/utils/emailEditor/diagnostics/types";

type Props = {
  diagnostics: DiagnosticItem[];
  activeId: string | null;
};
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "select", id: string | null): void;
  (e: "jump", id: string): void;
}>();

const { t } = useI18n();

function iconFor(sev: string) {
  return sev === "error" ? "i-lucide-octagon-alert" : "i-lucide-triangle-alert";
}

function sevLabel(sev: string) {
  return sev === "error"
      ? t("services.emailEditor.diagnostics.severity.error")
      : t("services.emailEditor.diagnostics.severity.warning");
}

function metaText(d: any) {
  const line = d?.approxLine ?? null;
  const lineText = line ? `${t("services.emailEditor.diagnostics.line")} ${line}` : t("services.emailEditor.diagnostics.lineUnknown");
  return `${sevLabel(d.severity)} • ${d.ruleId} • ${lineText}`;
}
</script>

<template>
  <div class="email-editor-diagnostics ui-anim-border">
    <div class="ui-anim-border__inner email-editor-diagnostics__inner">
      <div class="email-editor-diagnostics__title">
        <u-icon name="i-lucide-list-checks" />
        <span>{{ t("services.emailEditor.diagnostics.title") }}</span>
        <span class="email-editor-diagnostics__count text-muted">
          ({{ props.diagnostics.length }})
        </span>
      </div>

      <div v-if="!props.diagnostics.length" class="email-editor-diagnostics__empty text-muted">
        {{ t("services.emailEditor.diagnostics.noIssues") }}
      </div>

      <ul v-else class="email-editor-diagnostics__list">
        <li
            v-for="d in props.diagnostics"
            :key="d.id"
            class="email-editor-diagnostics__item"
            :class="{ 'email-editor-diagnostics__item_active': d.id === props.activeId }"
            @click="emit('select', d.id)"
            @dblclick="emit('jump', d.id)"
        >
          <u-icon :name="iconFor(d.severity)" />
          <div class="email-editor-diagnostics__item-body">
            <div class="email-editor-diagnostics__item-message">
              {{ t(d.messageKey, d.messageParams || {}) }}
            </div>
            <div class="email-editor-diagnostics__item-meta text-muted">
              {{ metaText(d) }}
            </div>
          </div>
        </li>
      </ul>

      <div class="email-editor-diagnostics__help text-muted">
        {{ t("services.emailEditor.diagnostics.tip") }}
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.email-editor-diagnostics {
  border-radius: 10px;
}

.email-editor-diagnostics__inner {
  border-radius: 10px;
  padding: 12px;
}

.email-editor-diagnostics__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 10px;
}

.light .email-editor-diagnostics__title {
  color: rgba(21, 22, 42, 0.85);
}

.email-editor-diagnostics__list {
  display: grid;
  gap: 8px;
}

.email-editor-diagnostics__item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.light .email-editor-diagnostics__item {
  background: rgba(21, 22, 42, 0.03);
  border-color: rgba(21, 22, 42, 0.08);
}

.email-editor-diagnostics__item_active {
  outline: 1px solid rgba(120, 190, 255, 0.55);
}

.email-editor-diagnostics__item-message {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.light .email-editor-diagnostics__item-message {
  color: rgba(21, 22, 42, 0.86);
}

.email-editor-diagnostics__item-meta {
  font-size: 12px;
  margin-top: 2px;
}

.email-editor-diagnostics__empty {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.light .email-editor-diagnostics__empty {
  background: rgba(21, 22, 42, 0.03);
  border-color: rgba(21, 22, 42, 0.08);
}

.email-editor-diagnostics__help {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.35;
}
</style>
