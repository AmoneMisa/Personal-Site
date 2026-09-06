<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";
import type {TabsItem} from "#ui/components/Tabs.vue";
import {nextTick, onBeforeUnmount, onMounted, watch} from "vue";
import Modal from "~/components/common/Modal.vue";
import {checkTextWithLanguageTool} from "~/composables/useLanguageTool";
import {useScrollableTabs} from "~/composables/ui/useScrollableTabs";
import {
  formatPlatformText,
  highlightLanguageMatches,
  renderPlatformPreview,
  type MarkdownPlatform,
} from "~/utils/markdownEditor/platformFormatters";
import {useMarkdownDraft, type MarkdownViewMode} from "~/composables/markdownEditor/useMarkdownDraft";
import {useMarkdownEditing} from "~/composables/markdownEditor/useMarkdownEditing";

type PlatformId = MarkdownPlatform;
type ViewMode = MarkdownViewMode;

const {t, locale} = useI18n();

useServiceSeo("markdownEditor");

const MAX = 8000;
const STORAGE_KEY = "services:markdown-editor:v3";

const input = ref<string>("");
const inputRef = ref<HTMLTextAreaElement | null>(null);

const viewMode = ref<ViewMode>("md");
const activePlatform = ref<PlatformId>("telegram");

const showEmoji = ref(false);
const {
  linkOpen,
  linkText,
  linkUrl,
  focusEditor,
  wrapSelection,
  toggleQuote,
  toggleCodeBlock,
  applyList,
  formatList,
  openLinkModal,
  insertLinkConfirmed,
  onEmoji,
} = useMarkdownEditing(input, inputRef, showEmoji);
const copied = ref(false);
const spellcheckEnabled = ref(true);
const {copyText} = useClipboard();
const {load: loadDraft} = useMarkdownDraft({
  storageKey: STORAGE_KEY,
  maxLength: MAX,
  input,
  platform: activePlatform,
  viewMode,
  spellcheckEnabled,
});

const plainLen = computed(() => input.value.length);
const isTooLong = computed(() => plainLen.value > MAX);

const platformTabs = computed<TabsItem[]>(() => ([
  {label: "services.markdownEditor.platforms.telegram", value: "telegram"},
  {label: "services.markdownEditor.platforms.whatsapp", value: "whatsapp"},
  {label: "services.markdownEditor.platforms.tiktok", value: "tiktok"}
]));

const canCopy = computed(() => !!outputText.value && !isTooLong.value);

const outputText = computed(() => {
  return formatPlatformText(input.value, activePlatform.value);
});
const checking = ref(false);
const checkResult = ref(null);
let checkRequestId = 0;
let checkController: AbortController | undefined;

const highlightedPreview = computed(() => {
  if (!checkResult.value || !checkResult.value.matches?.length) return null;
  return highlightLanguageMatches(previewHtml.value, checkResult.value.matches);
});

const previewHtml = computed(() => {
  return renderPlatformPreview(outputText.value, activePlatform.value);
});

// --------------------
// Copy / clear / persist / check
// --------------------
async function copyOutput() {
  if (isTooLong.value) return;
  if (await copyText(outputText.value)) {
    copied.value = true;
    setTimeout(() => (copied.value = false), 900);
  }
}

async function checkOutput() {
  const text = outputText.value;
  if (!text) return;

  checkController?.abort();
  const controller = new AbortController();
  checkController = controller;
  const requestId = ++checkRequestId;
  checking.value = true
  checkResult.value = null

  try {
    const lang = locale.value.startsWith('ru') ? 'ru' : 'en'
    const result = await checkTextWithLanguageTool(text, lang, {signal: controller.signal});
    if (requestId === checkRequestId && text === outputText.value) {
      checkResult.value = result;
    }
  } catch (e) {
    if (!(e instanceof Error && e.name === "AbortError")) console.error(e)
  } finally {
    if (requestId === checkRequestId) checking.value = false
  }
}

function clearAll() {
  input.value = "";
  showEmoji.value = false;
  focusEditor();
}

const platformTabIndex = computed(() => {
  const idx = platformTabs.value.findIndex((x: any) => x.value === activePlatform.value);
  return Math.max(0, idx);
});
const {scrollRef: platformTabsScroll, select: selectPlatformTab} = useScrollableTabs();

async function onPlatformTabChange(value: PlatformId) {
  activePlatform.value = value;
  await selectPlatformTab(platformTabIndex.value);
}

onMounted(async () => {
  loadDraft();
  await import("emoji-picker-element");
  await nextTick();
});

watch(outputText, () => {
  if (!checkController) return;
  checkController.abort();
  checkController = undefined;
  checkRequestId += 1;
  checking.value = false;
  checkResult.value = null;
});

onBeforeUnmount(() => {
  checkController?.abort();
});
</script>

<template>
  <u-container class="markdown-editor">
    <service-page-header
        backdrop="reef"
        title="services.markdownEditor.title"
        headline="services.markdownEditor.headline"
        description="services.markdownEditor.subtitle"
    />
    <section class="markdown-editor__card">
      <div class="markdown-editor__top">
        <div class="markdown-editor__toolbar">
          <button class="markdown-editor__icon-btn" type="button" @click="wrapSelection('**'); focusEditor()"
                  :title="t('services.markdownEditor.tools.bold')">
            <b>B</b>
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="wrapSelection('*'); focusEditor()"
                  :title="t('services.markdownEditor.tools.italic')">
            <i>I</i>
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="wrapSelection('__'); focusEditor()"
                  :title="t('services.markdownEditor.tools.underline')">
            <u>U</u>
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="wrapSelection('~~'); focusEditor()"
                  :title="t('services.markdownEditor.tools.strike')">
            <s>S</s>
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="wrapSelection('||'); focusEditor()"
                  :title="t('services.markdownEditor.tools.spoiler')">
            ||
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="wrapSelection('`'); focusEditor()"
                  :title="t('services.markdownEditor.tools.code')">
            <span class="markdown-editor__mono">`</span>
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="toggleCodeBlock(); focusEditor()"
                  :title="t('services.markdownEditor.tools.codeBlock')">
            <span class="markdown-editor__mono">```</span>
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="toggleQuote(); focusEditor()"
                  :title="t('services.markdownEditor.tools.quote')">
            “”
          </button>
          <button class="markdown-editor__icon-btn" type="button" @click="openLinkModal"
                  :title="t('services.markdownEditor.tools.link')">
            🔗
          </button>
          <custom-button
              variant="secondary"
              :_class="'markdown-editor__btn'"
              @click="applyList('ul'); focusEditor()"
          >
            {{ t("services.markdownEditor.lists.ul") }}
          </custom-button>

          <custom-button
              variant="secondary"
              :_class="'markdown-editor__btn'"
              @click="applyList('ol'); focusEditor()"
          >
            {{ t("services.markdownEditor.lists.ol") }}
          </custom-button>

          <custom-button
              variant="ghost"
              :_class="'markdown-editor__btn'"
              @click="formatList(); focusEditor()"
          >
            {{ t("services.markdownEditor.lists.format") }}
          </custom-button>

          <custom-button
              variant="ghost"
              :_class="'markdown-editor__btn'"
              @click="showEmoji = !showEmoji"
          >
            😀 {{ t("services.markdownEditor.actions.emoji") }}
          </custom-button>

          <custom-button
              variant="ghost"
              :_class="'markdown-editor__btn'"
              @click="spellcheckEnabled = !spellcheckEnabled"
          >
            <u-icon :name="spellcheckEnabled ? 'i-lucide-check' : 'i-lucide-x'"/>
            {{ t("services.markdownEditor.actions.spellcheck") }}
          </custom-button>

          <custom-button
              variant="ghost"
              :_class="'markdown-editor__btn markdown-editor__btn_right'"
              @click="clearAll"
          >
            {{ t("services.markdownEditor.actions.clearAll") }}
          </custom-button>
        </div>

        <div class="markdown-editor__counter" :class="{ 'markdown-editor__counter_bad': isTooLong }">
          {{ plainLen }}/{{ MAX }}
        </div>
      </div>

      <div class="markdown-editor__emoji" v-if="showEmoji">
        <ClientOnly>
          <emoji-picker @emoji-click="onEmoji"/>
        </ClientOnly>
      </div>

      <div class="markdown-editor__editor-wrap">
        <textarea
            ref="inputRef"
            class="markdown-editor__editor"
            v-model="input"
            :placeholder="t('services.markdownEditor.editor.placeholder')"
            :spellcheck="spellcheckEnabled"
            rows="10"
        />
        <div v-if="isTooLong" class="markdown-editor__warning">
          {{ t("services.markdownEditor.errors.tooLong", {max: MAX}) }}
        </div>
      </div>

      <div class="markdown-editor__output-head">
        <div class="markdown-editor__output-title">
          {{ t("services.markdownEditor.right.title") }}
        </div>

        <div class="markdown-editor__output-actions">
          <custom-button
              type="button"
              class="markdown-editor__mode"
              variant="primary"
              :class="{ 'markdown-editor__mode_active': viewMode === 'md' }"
              @click="viewMode = 'md'"
          >
            {{ t("services.markdownEditor.right.modeMarkdown") }}
          </custom-button>

          <custom-button
              type="button"
              variant="primary"
              class="markdown-editor__mode"
              :class="{ 'markdown-editor__mode_active': viewMode === 'preview' }"
              @click="viewMode = 'preview'"
          >
            {{ t("services.markdownEditor.right.modePreview") }}
          </custom-button>

          <custom-button
              variant="primary"
              :_class="'markdown-editor__copy'"
              :disabled="checking"
              @click="checkOutput"
          >
            {{ checking ? t("services.markdownEditor.actions.checking") : t("services.markdownEditor.actions.check") }}
          </custom-button>
          <custom-button
              variant="primary"
              :_class="'markdown-editor__copy'"
              :disabled="!canCopy"
              @click="copyOutput"
          >
            {{ copied ? t("services.markdownEditor.actions.copied") : t("services.markdownEditor.actions.copy") }}
          </custom-button>
        </div>
      </div>

      <div class="markdown-editor__tabs-row">
        <div ref="platformTabsScroll" class="tabs-scroll">
          <div class="tabs-head">
            <u-tabs
                :items="platformTabs"
                :model-value="activePlatform"
                @update:modelValue="onPlatformTabChange"
                :ui="{ trigger: 'tabs__trigger', list: 'tabs__list mt-4', indicator: 'hidden' }"
            >
              <template #default="{ item }">
                {{ t(item.label) }}
              </template>

              <template #content>
                <div class="markdown-editor__platform-hint text-muted">
                  <span v-if="activePlatform === 'telegram'">{{
                      t("services.markdownEditor.platformHints.telegram")
                    }}</span>
                  <span v-else-if="activePlatform === 'whatsapp'">{{
                      t("services.markdownEditor.platformHints.whatsapp")
                    }}</span>
                  <span v-else>{{ t("services.markdownEditor.platformHints.tiktok") }}</span>
                </div>

                <textarea
                    v-if="viewMode === 'md'"
                    class="markdown-editor__output"
                    :value="outputText"
                    readonly
                    rows="10"
                />

                <div v-else class="markdown-editor__preview" v-html="previewHtml"/>
                <div
                    v-if="highlightedPreview"
                    class="markdown-editor__preview markdown-editor__preview_errors"
                    v-html="highlightedPreview"
                />
              </template>
            </u-tabs>
          </div>
        </div>
      </div>
    </section>

    <modal v-model:open="linkOpen" max-width-class="sm:max-w-2xl">
      <template #title>
        {{ t("services.markdownEditor.link.title") }}
      </template>

      <div class="markdown-editor__modal-grid">
        <div class="markdown-editor__modal-field">
          <div class="markdown-editor__modal-label">
            {{ t("services.markdownEditor.link.text") }}
          </div>
          <UInput v-model="linkText" :placeholder="t('services.markdownEditor.link.textPh')"/>
        </div>

        <div class="markdown-editor__modal-field">
          <div class="markdown-editor__modal-label">
            {{ t("services.markdownEditor.link.url") }}
          </div>
          <UInput v-model="linkUrl" placeholder="https://"/>
        </div>
      </div>

      <template #actions="{ close }">
        <custom-button variant="primary" @click="insertLinkConfirmed">
          {{ t("services.markdownEditor.actions.insert") }}
        </custom-button>
        <custom-button variant="secondary" class="bg-error" @click="close">
          {{ t("services.markdownEditor.actions.cancel") }}
        </custom-button>
      </template>
    </modal>

  </u-container>
</template>

<style scoped>
.markdown-editor {
  padding-top: 24px;
  padding-bottom: 96px;
}

.markdown-editor__subtitle {
  max-width: 760px;
  font-size: 14px;
}

.markdown-editor__card {
  margin-top: 18px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.markdown-editor__top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
}

.markdown-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.markdown-editor__icon-btn {
  height: 34px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ui-text);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease, opacity 160ms ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.markdown-editor__icon-btn:hover {
  filter: brightness(1.06);
}

.markdown-editor__icon-btn:active {
  transform: translateY(1px);
}

.markdown-editor__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.markdown-editor__btn {
  height: 34px;
}

.markdown-editor__btn_right {
  margin-left: auto;
}

@media (max-width: 520px) {
  .markdown-editor__btn_right {
    margin-left: 0;
  }
}

.markdown-editor__counter {
  font-size: 12px;
  color: var(--ui-text-muted);
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.markdown-editor__counter_bad {
  color: var(--color-error, #ef4444);
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
}

.markdown-editor__emoji {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.markdown-editor__editor-wrap {
  margin-top: 12px;
}

.markdown-editor__editor {
  width: 100%;
  border-radius: 10px;
  padding: 12px 12px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.12);
  color: var(--ui-text);
  outline: none;
  line-height: 1.55;
  resize: vertical;
  min-height: 260px;
  font-size: 14px;
}

.markdown-editor__editor:focus {
  box-shadow: 0 0 0 2px rgba(224, 103, 154, 0.30), 0 0 0 6px rgba(224, 103, 154, 0.14);
}

.markdown-editor__warning {
  margin-top: 10px;
  color: var(--color-error, #ef4444);
  font-weight: 600;
  font-size: 13px;
}

.markdown-editor__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.markdown-editor__output-head {
  margin-top: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.markdown-editor__output-title {
  font-weight: 600;
}

.markdown-editor__output-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.markdown-editor__mode:active {
  transform: translateY(1px);
}

.markdown-editor__mode_active {
  background-color: var(--color-primary);
}

.tabs-scroll {
  position: relative;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
  scrollbar-width: none;
  overflow-x: visible;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}

.tabs-head {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tabs-line-wrap {
  position: relative;
  height: 16px;
  margin: 0;
  padding: 0 4px;
}

.tabs-line {
  position: absolute;
  left: 0;
  top: 2px;
  height: 12px;
  width: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-primary-gradient-start), var(--color-primary-gradient-end));
  box-shadow: 0 8px 20px rgba(224, 103, 154, .25);
  transform: translateX(0);
  transition: transform .22s ease;
  will-change: transform;
}

:deep(.tabs__list) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 4px;
  border-radius: 8px;
  background: transparent;
}

:deep(.tabs__trigger) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 44px;
  padding: 0 18px;
  border-radius: 8px;
  background: rgba(22, 24, 30, .75);
  color: rgba(255, 255, 255, .88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04), inset 0 -10px 20px rgba(0, 0, 0, .25);
  transition: background .2s ease, color .2s ease, box-shadow .2s ease;
  font-weight: 600;
}

:deep(.tabs__trigger::before) {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: rgba(255, 255, 255, .06);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: .85;
  transition: opacity .2s ease, background .25s ease;
  pointer-events: none;
}

:deep(.tabs__trigger:hover) {
  background: rgba(22, 24, 30, .88);
}

:deep(.tabs__trigger:hover::before) {
  background: linear-gradient(90deg, var(--color-primary-gradient-start), var(--color-primary-gradient-end));
  opacity: 1;
}

:deep(.tabs__trigger[data-state="active"]) {
  color: rgba(255, 255, 255, .95);
  background: rgba(22, 24, 30, .92);
}

:deep(.tabs__trigger[data-state="active"]::before) {
  background: linear-gradient(90deg, var(--color-primary-gradient-start), var(--color-primary-gradient-end));
  opacity: 1;
}

.markdown-editor__platform-hint {
  font-size: 12px;
  margin-top: 10px;
  text-align: center;
}

/* output */
.markdown-editor__output,
.markdown-editor__preview {
  margin-top: 12px;
  width: 100%;
  border-radius: 10px;
  padding: 12px 12px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.12);
  color: var(--ui-text);
  outline: none;
  line-height: 1.55;
}

.markdown-editor__output {
  resize: vertical;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.markdown-editor__preview {
  font-size: 14px;
  word-break: break-word;
}

.markdown-editor__preview :deep(.pv-link) {
  color: var(--color-link);
  text-decoration: none;
  border-bottom: 1px dashed rgba(205, 153, 255, 0.28);
}

.markdown-editor__preview :deep(.pv-link:hover) {
  filter: brightness(1.08);
}

.markdown-editor__preview :deep(.pv-code) {
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
}

.markdown-editor__preview :deep(.pv-pre) {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  overflow: auto;
}

.markdown-editor__preview :deep(.pv-quote) {
  margin: 8px 0;
  padding: 8px 10px;
  border-left: 3px solid rgba(224, 103, 154, 0.65);
  background: rgba(224, 103, 154, 0.08);
  border-radius: 12px;
}

.markdown-editor__preview :deep(.pv-spoiler) {
  background: rgba(255, 255, 255, 0.08);
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  padding: 0 6px;
  color: transparent;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.30);
}

.markdown-editor__preview :deep(.pv-spoiler:hover) {
  color: inherit;
  text-shadow: none;
}

:deep(.markdown-editor__modal) {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(14, 12, 21, 0.92);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  padding: 16px;
}

.markdown-editor__modal-title {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 12px;
}

.markdown-editor__modal-grid {
  display: grid;
  gap: 12px;
}

.markdown-editor__modal-label {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 6px;
}

.markdown-editor__modal-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.markdown-editor__modal-btn {
  height: 40px;
}

.markdown-editor__modal-grid {
  display: grid;
  gap: 12px;
}

@media (min-width: 640px) {
  .markdown-editor__modal-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.markdown-editor__modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.markdown-editor__modal-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.lt-error-typo {
  background: rgba(255, 0, 0, 0.25);
  border-bottom: 2px solid red;
}

.lt-error-grammar {
  background: rgba(255, 165, 0, 0.25);
  border-bottom: 2px solid orange;
}

.lt-error-punct {
  background: rgba(128, 0, 128, 0.25);
  border-bottom: 2px solid purple;
}

.lt-error-style {
  background: rgba(0, 128, 255, 0.25);
  border-bottom: 2px solid #0080ff;
}

.lt-error-generic {
  background: rgba(255, 0, 0, 0.15);
  border-bottom: 2px solid #cc0000;
}

</style>
