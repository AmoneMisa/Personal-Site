<script setup lang="ts">
const props = defineProps<{ paste: string; error: string | null; loading: boolean; ready: boolean }>();
const emit = defineEmits<{ "update:paste": [value: string]; upload: [event: Event]; apply: []; clear: [] }>();
const { t: translate } = useI18n();
const t = (key: string) => translate(`jobs.${key}`);
const pasteModel = computed({ get: () => props.paste, set: (value: string) => emit("update:paste", value) });
</script>

<template>
  <section class="ats">
    <div class="ats__head"><u-icon name="i-lucide-file-check-2" class="ats__icon" /><div><div class="ats__title">{{ t("atsTitle") }}</div><div class="ats__intro text-muted">{{ t("atsIntro") }}</div></div></div>
    <div class="ats__body">
      <label class="ats__upload"><input type="file" accept=".pdf,.docx,.txt,.md" class="hidden" @change="emit('upload', $event)" /><u-icon name="i-lucide-upload" /> {{ t("atsUpload") }}</label>
      <u-textarea v-model="pasteModel" :rows="3" :placeholder="t('atsPaste')" class="ats__paste" @blur="emit('apply')" />
      <div class="ats__actions"><u-button v-if="ready" variant="soft" color="neutral" icon="i-lucide-x" @click="emit('clear')">{{ t("atsClear") }}</u-button></div>
    </div>
    <p v-if="error" class="ats__error">{{ error }}</p>
    <p v-else-if="loading" class="text-muted ats__status">…</p>
    <p v-else-if="ready" class="ats__status ats__status_ready">{{ t("atsReady") }}</p>
  </section>
</template>

<style scoped>
.ats { margin: 28px 0 8px; padding: 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-panel); }
.ats__head { display: flex; gap: 12px; align-items: flex-start; }
.ats__icon { font-size: 22px; color: var(--color-primary, #e0679a); margin-top: 2px; }
.ats__title { font-weight: 600; }
.ats__intro { font-size: 13px; }
.ats__body { display: grid; gap: 10px; margin-top: 12px; align-items: center; grid-template-columns: 1fr; }
.ats__upload { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 0; max-width: 100%; min-height: 40px; padding: 8px 14px; border-radius: 10px; cursor: pointer; border: 1px dashed rgba(224,103,154,.5); color: var(--text-white, inherit); font-weight: 700; font-size: 13px; line-height: 1.25; white-space: normal; text-align: center; }
.ats__paste { width: 100%; }
.ats__actions { display: flex; justify-content: flex-end; }
.ats__status, .ats__error { margin-top: 10px; font-size: 13px; }
.ats__status_ready { color: #34d399; }
.ats__error { color: var(--ui-error, #f87171); }
.hidden { display: none; }
@media (min-width: 800px) { .ats__body { grid-template-columns: auto 1fr auto; } }
</style>
