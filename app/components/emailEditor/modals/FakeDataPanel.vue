<script setup lang="ts">
import Modal from "~/components/common/Modal.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import { computed, ref } from "vue";

const { t } = useI18n();

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  detectedPaths: string[];
  values: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: "update:value", payload: { path: string; value: string }): void;
  (e: "add", path: string): void;
  (e: "remove", path: string): void;
}>();

const newPath = ref("");

// All paths to show: detected ones first, then any custom paths the user added.
const allPaths = computed(() => {
  const detected = props.detectedPaths ?? [];
  const extra = Object.keys(props.values).filter((p) => !detected.includes(p));
  extra.sort((a, b) => a.localeCompare(b));
  return [...detected, ...extra];
});

const detectedSet = computed(() => new Set(props.detectedPaths ?? []));

function onInput(path: string, value: string) {
  emit("update:value", { path, value });
}

function addPath() {
  const p = newPath.value.trim();
  if (!p) return;
  emit("add", p);
  newPath.value = "";
}
</script>

<template>
  <modal v-model:open="open" max-width-class="sm:max-w-2xl">
    <template #title>{{ t("services.emailEditor.fakeData.title") }}</template>

    <div class="email-editor-fake">
      <p class="email-editor-fake__intro text-muted">
        {{ t("services.emailEditor.fakeData.intro") }}
      </p>

      <div v-if="allPaths.length" class="email-editor-fake__list">
        <div v-for="path in allPaths" :key="path" class="email-editor-fake__row">
          <div class="email-editor-fake__path" :title="path">
            <u-icon name="i-lucide-variable" class="email-editor-fake__path-icon" />
            <code class="email-editor-fake__path-text">{{ path }}</code>
            <span
                v-if="!detectedSet.has(path)"
                class="email-editor-fake__badge"
            >{{ t("services.emailEditor.fakeData.custom") }}</span>
          </div>

          <custom-input
              class="email-editor-fake__value"
              :model-value="props.values[path] ?? ''"
              :placeholder="t('services.emailEditor.fakeData.valuePlaceholder')"
              @update:model-value="onInput(path, $event)"
          />

          <button
              type="button"
              class="email-editor-fake__remove"
              :aria-label="t('services.emailEditor.fakeData.remove')"
              :title="t('services.emailEditor.fakeData.remove')"
              @click="emit('remove', path)"
          >
            <u-icon name="i-lucide-trash-2" />
          </button>
        </div>
      </div>

      <div v-else class="email-editor-fake__empty text-muted">
        {{ t("services.emailEditor.fakeData.empty") }}
      </div>

      <div class="email-editor-fake__add">
        <custom-input
            v-model="newPath"
            class="email-editor-fake__add-input"
            :label="t('services.emailEditor.fakeData.addLabel')"
            :placeholder="t('services.emailEditor.fakeData.addPlaceholder')"
            @keydown.enter.prevent="addPath"
        />
        <custom-button variant="secondary" @click="addPath">
          <u-icon name="i-lucide-plus" />
          {{ t("services.emailEditor.fakeData.add") }}
        </custom-button>
      </div>
    </div>

    <template #actions="{ close }">
      <custom-button variant="full" @click="close()">
        {{ t("services.emailEditor.fakeData.done") }}
      </custom-button>
    </template>
  </modal>
</template>

<style scoped lang="scss">
.email-editor-fake {
  display: grid;
  gap: 12px;
}

.email-editor-fake__intro {
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
}

.email-editor-fake__list {
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.email-editor-fake__row {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr) auto;
  align-items: center;
  gap: 10px;
}

.email-editor-fake__path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.email-editor-fake__path-icon {
  flex: 0 0 auto;
  opacity: 0.7;
}

.email-editor-fake__path-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(128, 90, 245, 0.14);
  border: 1px solid rgba(128, 90, 245, 0.22);
}

.email-editor-fake__badge {
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--ui-border);
  opacity: 0.8;
}

.email-editor-fake__remove {
  height: 34px;
  width: 34px;
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.14);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
}

.email-editor-fake__remove:hover {
  filter: brightness(1.08);
}

.email-editor-fake__remove:active {
  transform: translateY(1px);
}

.email-editor-fake__empty {
  padding: 14px;
  border-radius: 14px;
  border: 1px dashed var(--ui-border);
  text-align: center;
  font-size: 12px;
}

.email-editor-fake__add {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--ui-border);
}
</style>
