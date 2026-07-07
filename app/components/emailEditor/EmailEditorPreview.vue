<script setup lang="ts">
import { computed } from "vue";
import type { PreviewClient, TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";
import { buildPreviewHtml } from "~/utils/emailEditor/preview/buildPreviewHtml";

const props = defineProps<{
  code: string;
  templateEngine: TemplateEngine;
  previewClient: PreviewClient;
  fakeData?: { enabled: boolean; values: Record<string, string> };
}>();

const srcDoc = computed(() =>
    buildPreviewHtml({
      code: props.code,
      templateEngine: props.templateEngine,
      previewClient: props.previewClient,
      fakeData: props.fakeData,
    })
);
</script>

<template>
  <div class="email-editor-preview">
    <iframe
        class="email-editor-preview__frame"
        :srcdoc="srcDoc"
        sandbox=""
        referrerpolicy="no-referrer"
    />
    <div class="email-editor-preview__hint text-muted">
      {{ $t("services.emailEditor.preview.hint") }}
    </div>
  </div>
</template>

<style lang="scss">
.email-editor-preview__frame {
  width: 100%;
  height: 520px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
}

.light .email-editor-preview__frame {
  background: rgba(255, 255, 255, 0.9);
}

.email-editor-preview__hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.35;
}
</style>
