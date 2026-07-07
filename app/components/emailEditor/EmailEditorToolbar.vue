<script setup lang="ts">
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import type { PreviewClient, TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";

type ToolbarAction =
    | "moveInlineStylesToStyleTag"
    | "openInsertImage"
    | "openInsertLink"
    | "openInsertTemplate"
    | "openFakeData";

const props = defineProps<{
  templateEngine: TemplateEngine;
  previewClient: PreviewClient;
  isBusy: boolean;
  fakeDataEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: "update:template-engine", v: TemplateEngine): void;
  (e: "update:preview-client", v: PreviewClient): void;
  (e: "update:fake-data-enabled", v: boolean): void;
  (e: "action", a: ToolbarAction): void;
}>();

const { t } = useI18n();

// Fake data only substitutes variables for template engines (not clean HTML).
const fakeDataAvailable = computed(() => props.templateEngine !== "clean_html");

const templateItems = computed(() => [
  { label: t("services.emailEditor.template.cleanHtml"), value: "clean_html" },
  { label: t("services.emailEditor.template.freemarker"), value: "freemarker" },
  { label: t("services.emailEditor.template.velocity"), value: "velocity" },
]);

const previewItems = computed(() => [
  { label: t("services.emailEditor.preview.gmail"), value: "gmail" },
  { label: t("services.emailEditor.preview.yandex"), value: "yandex" },
  { label: t("services.emailEditor.preview.outlook"), value: "outlook" },
]);
</script>

<template>
  <div class="email-editor-toolbar">
    <div class="email-editor-toolbar__left">
      <u-select
          class="email-editor-toolbar__select"
          :items="templateItems"
          option-attribute="label"
          value-attribute="value"
          :model-value="props.templateEngine"
          @update:model-value="emit('update:template-engine', $event as any)"
      />

      <u-select
          class="email-editor-toolbar__select"
          :items="previewItems"
          option-attribute="label"
          value-attribute="value"
          :model-value="props.previewClient"
          @update:model-value="emit('update:preview-client', $event as any)"
      />

      <div class="email-editor-toolbar__fake" :class="{ 'email-editor-toolbar__fake_disabled': !fakeDataAvailable }">
        <custom-checkbox
            :model-value="props.fakeDataEnabled"
            :label="t('services.emailEditor.fakeData.toggle')"
            :disabled="props.isBusy || !fakeDataAvailable"
            @update:model-value="emit('update:fake-data-enabled', $event)"
        />

        <button
            v-if="props.fakeDataEnabled && fakeDataAvailable"
            type="button"
            class="ui-pill-btn email-editor-toolbar__button"
            :disabled="props.isBusy"
            @click="emit('action', 'openFakeData')"
        >
          <span class="ui-pill-btn__inner">
            <u-icon name="i-lucide-database" />
            {{ t("services.emailEditor.fakeData.edit") }}
          </span>
        </button>
      </div>
    </div>

    <div class="email-editor-toolbar__right">
      <button
          type="button"
          class="ui-pill-btn ui-pill-btn_animated email-editor-toolbar__button"
          :disabled="props.isBusy"
          @click="emit('action', 'moveInlineStylesToStyleTag')"
      >
        <span class="ui-pill-btn__inner">
          <u-icon name="i-lucide-wand-2" />
          {{ t("services.emailEditor.actions.moveInlineStylesToStyle") }}
        </span>
      </button>

      <button
          type="button"
          class="ui-pill-btn email-editor-toolbar__button"
          :disabled="props.isBusy"
          @click="emit('action', 'openInsertImage')"
      >
        <span class="ui-pill-btn__inner">
          <u-icon name="i-lucide-image-plus" />
          {{ t("services.emailEditor.actions.insertImage") }}
        </span>
      </button>

      <button
          type="button"
          class="ui-pill-btn email-editor-toolbar__button"
          :disabled="props.isBusy"
          @click="emit('action', 'openInsertLink')"
      >
        <span class="ui-pill-btn__inner">
          <u-icon name="i-lucide-link" />
          {{ t("services.emailEditor.actions.insertLink") }}
        </span>
      </button>

      <button
          type="button"
          class="ui-pill-btn email-editor-toolbar__button"
          :disabled="props.isBusy"
          @click="emit('action', 'openInsertTemplate')"
      >
        <span class="ui-pill-btn__inner">
          <u-icon name="i-lucide-braces" />
          {{ t("services.emailEditor.actions.insertTemplate") }}
        </span>
      </button>
    </div>
  </div>
</template>

<style lang="scss">
.email-editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.email-editor-toolbar__left,
.email-editor-toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.email-editor-toolbar__select {
  min-width: 180px;
}

.email-editor-toolbar__button {
  white-space: nowrap;
}

.email-editor-toolbar__fake {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.email-editor-toolbar__fake_disabled {
  opacity: 0.7;
}
</style>
