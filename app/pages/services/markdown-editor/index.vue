<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import type {TabsItem} from "#ui/components/Tabs.vue";
import {nextTick, onBeforeUnmount, onMounted} from "vue";
import Modal from "~/components/common/Modal.vue";
import {checkTextWithLanguageTool} from "~/composables/useLanguageTool";

type PlatformId = "telegram" | "whatsapp" | "tiktok";
type ViewMode = "md" | "preview";

const {t, locale} = useI18n();

useSeoMeta({
  title: () => t('seo.pages.markdownEditor.title'),
  description: () => t('seo.pages.markdownEditor.description'),
  robots: () => t('seo.common.robots'),
  ogType: "website",
  ogSiteName: () => t('seo.common.siteName'),
  ogTitle: () => t('seo.pages.markdownEditor.ogTitle'),
  ogDescription: () => t('seo.pages.markdownEditor.ogDescription')
});

const MAX = 8000;
const STORAGE_KEY = "services:markdown-editor:v3";

const input = ref<string>("");
const inputRef = ref<HTMLTextAreaElement | null>(null);

const viewMode = ref<ViewMode>("md");
const activePlatform = ref<PlatformId>("telegram");

const showEmoji = ref(false);

const linkOpen = ref(false);
const linkText = ref("");
const linkUrl = ref("https://");
const linkSelStart = ref<number>(0);
const linkSelEnd = ref<number>(0);
const copied = ref(false);
const spellcheckEnabled = ref(true);

const plainLen = computed(() => input.value.length);
const isTooLong = computed(() => plainLen.value > MAX);

const platformTabs = computed<TabsItem[]>(() => ([
  {label: "services.markdownEditor.platforms.telegram", value: "telegram"},
  {label: "services.markdownEditor.platforms.whatsapp", value: "whatsapp"},
  {label: "services.markdownEditor.platforms.tiktok", value: "tiktok"}
]));

const canCopy = computed(() => !!outputText.value && !isTooLong.value);

// --------------------
// Editor helpers
// --------------------
function clampToMax() {
  if (input.value.length > MAX) input.value = input.value.slice(0, MAX);
}

function focusEditor() {
  requestAnimationFrame(() => inputRef.value?.focus());
}

function insertAtCursor(text: string) {
  const el = inputRef.value;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;

  input.value = input.value.slice(0, start) + text + input.value.slice(end);

  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

function wrapSelection(left: string, right = left) {
  const el = inputRef.value;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;

  const before = input.value.slice(0, start);
  const selected = input.value.slice(start, end);
  const after = input.value.slice(end);

  const hasWrap = before.endsWith(left) && after.startsWith(right);
  if (hasWrap) {
    input.value = before.slice(0, -left.length) + selected + after.slice(right.length);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start - left.length, end - left.length);
    });
    return;
  }

  input.value = before + left + selected + right + after;

  requestAnimationFrame(() => {
    el.focus();
    if (selected.length) el.setSelectionRange(start + left.length, end + left.length);
    else {
      const pos = start + left.length;
      el.setSelectionRange(pos, pos);
    }
  });
}

function toggleQuote() {
  const el = inputRef.value;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;

  const full = input.value;
  const lineStart = full.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = full.indexOf("\n", end);
  const realEnd = lineEnd === -1 ? full.length : lineEnd;

  const before = full.slice(0, lineStart);
  const block = full.slice(lineStart, realEnd);
  const after = full.slice(realEnd);

  const lines = block.split("\n");
  const allQuoted = lines.every((l) => l.startsWith("> "));
  const nextLines = allQuoted
      ? lines.map((l) => l.replace(/^>\s/, ""))
      : lines.map((l) => (l.trim().length ? `> ${l}` : l));

  const nextBlock = nextLines.join("\n");
  input.value = before + nextBlock + after;

  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(lineStart, lineStart + nextBlock.length);
  });
}

function toggleCodeBlock() {
  const el = inputRef.value;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;

  const selected = input.value.slice(start, end);
  const fence = "```";

  const before = input.value.slice(0, start);
  const after = input.value.slice(end);

  const hasWrap = before.endsWith(fence + "\n") && after.startsWith("\n" + fence);
  if (hasWrap) {
    input.value = before.slice(0, -(fence.length + 1)) + selected + after.slice(fence.length + 1);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start - (fence.length + 1), end - (fence.length + 1));
    });
    return;
  }

  const block = `${fence}\n${selected || "text"}\n${fence}`;
  input.value = input.value.slice(0, start) + block + input.value.slice(end);

  requestAnimationFrame(() => {
    el.focus();
    const innerStart = start + fence.length + 1;
    const innerEnd = innerStart + (selected ? selected.length : 4);
    el.setSelectionRange(innerStart, innerEnd);
  });
}

// --------------------
// Lists
// --------------------
function applyList(kind: "ul" | "ol") {
  const el = inputRef.value;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;

  const full = input.value;

  const lineStart = full.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = full.indexOf("\n", end);
  const realEnd = lineEnd === -1 ? full.length : lineEnd;

  const before = full.slice(0, lineStart);
  const block = full.slice(lineStart, realEnd);
  const after = full.slice(realEnd);

  const lines = block.split("\n");
  let n = 1;

  const mapped = lines.map((l) => {
    const raw = l.trimEnd();
    if (!raw.trim()) return raw;

    const cleaned = raw.replace(/^(\s*)([-*•]|\d+\.)\s+/, "$1");
    if (kind === "ul") return `- ${cleaned.trimStart()}`;
    return `${n++}. ${cleaned.trimStart()}`;
  });

  const nextBlock = mapped.join("\n");
  input.value = before + nextBlock + after;

  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(lineStart, lineStart + nextBlock.length);
  });
}

function formatList() {
  const el = inputRef.value;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const full = input.value;

  const lineStart = full.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = full.indexOf("\n", end);
  const realEnd = lineEnd === -1 ? full.length : lineEnd;

  const before = full.slice(0, lineStart);
  const block = full.slice(lineStart, realEnd);
  const after = full.slice(realEnd);

  const lines = block.split("\n");

  const numbered = lines.filter((l) => /^\s*\d+\.\s+/.test(l)).length;
  const bulleted = lines.filter((l) => /^\s*[-*•]\s+/.test(l)).length;
  const kind: "ul" | "ol" = numbered > bulleted ? "ol" : "ul";

  let n = 1;
  const mapped = lines.map((l) => {
    const raw = l.trimEnd();
    if (!raw.trim()) return raw;

    const m = raw.match(/^(\s*)(.*)$/);
    const indent = m?.[1] ?? "";
    const rest = (m?.[2] ?? "").replace(/^(\s*)([-*•]|\d+\.)\s+/, "$1").trimStart();

    if (kind === "ul") return `${indent}- ${rest}`;
    return `${indent}${n++}. ${rest}`;
  });

  const nextBlock = mapped.join("\n");
  input.value = before + nextBlock + after;

  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(lineStart, lineStart + nextBlock.length);
  });
}

// --------------------
// Link modal
// --------------------
function openLinkModal() {
  const el = inputRef.value;
  if (!el) return;

  linkSelStart.value = el.selectionStart ?? 0;
  linkSelEnd.value = el.selectionEnd ?? 0;

  const selected = input.value.slice(linkSelStart.value, linkSelEnd.value);

  linkText.value = selected || "";
  linkUrl.value = "https://";
  linkOpen.value = true;
}

async function insertLinkConfirmed() {
  const el = inputRef.value;
  if (!el) return;

  const start = linkSelStart.value ?? (el.selectionStart ?? 0);
  const end = linkSelEnd.value ?? (el.selectionEnd ?? 0);

  const txt = (linkText.value || input.value.slice(start, end) || "link").trim();
  const url = (linkUrl.value || "").trim();
  if (!url) return;

  const snippet = `[${txt}](${url})`;

  input.value = input.value.slice(0, start) + snippet + input.value.slice(end);

  linkOpen.value = false;

  await nextTick();

  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start, start + snippet.length);
  });
}

// --------------------
// Emoji
// --------------------
function onEmoji(e: any) {
  const emoji = e?.detail?.unicode;
  if (emoji) insertAtCursor(emoji);
}

// --------------------
// Output transforms
// --------------------
function stripAllMarkdown(raw: string) {
  let s = raw;
  s = s.replace(/```([\s\S]*?)```/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  s = s.replace(/^\s*>\s?/gm, "");
  s = s.replace(/\|\|([\s\S]*?)\|\|/g, "$1");
  s = s.replace(/\*\*([\s\S]*?)\*\*/g, "$1");
  s = s.replace(/__([\s\S]*?)__/g, "$1");
  s = s.replace(/~~([\s\S]*?)~~/g, "$1");
  s = s.replace(/\*([\s\S]*?)\*/g, "$1");
  return s;
}

function toWhatsAppStable(raw: string) {
  let s = raw;
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  s = s.replace(/\|\|([\s\S]*?)\|\|/g, "$1");
  s = s.replace(/__([\s\S]*?)__/g, "$1");
  s = s.replace(/`([^`]+)`/g, "```$1```");
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "_$1_");
  s = s.replace(/\*\*([\s\S]*?)\*\*/g, "*$1*");
  s = s.replace(/~~([\s\S]*?)~~/g, "~$1~");
  return s;
}

const outputText = computed(() => {
  const raw = input.value;
  if (activePlatform.value === "telegram") return raw;
  if (activePlatform.value === "whatsapp") return toWhatsAppStable(raw);
  return stripAllMarkdown(raw);
});
const checking = ref(false);
const checkResult = ref(null);

function highlightErrorsInPreview(html: string, matches: any[]) {
  // Преобразуем HTML в plain-text индексы
  // Нам нужно сопоставить offset/length с HTML-строкой
  // Поэтому сначала убираем теги, чтобы получить карту позиций

  const textOnly = html.replace(/<[^>]+>/g, "");
  let result = "";
  let lastIndex = 0;

  matches.forEach((m) => {
    const start = m.offset;
    const end = m.offset + m.length;

    // Определяем цвет по типу ошибки
    const cat = m.rule?.category?.id || "";
    let cls = "lt-error-generic";

    if (cat.includes("TYPOS")) cls = "lt-error-typo";
    else if (cat.includes("GRAMMAR")) cls = "lt-error-grammar";
    else if (cat.includes("PUNCTUATION")) cls = "lt-error-punct";
    else if (cat.includes("STYLE")) cls = "lt-error-style";

    result += textOnly.slice(lastIndex, start);
    result += `<mark class="${cls}">${textOnly.slice(start, end)}</mark>`;
    lastIndex = end;
  });

  result += textOnly.slice(lastIndex);
  return result.replace(/\n/g, "<br/>");
}

const highlightedPreview = computed(() => {
  if (!checkResult.value || !checkResult.value.matches?.length) return null;
  const html = previewHtml.value;

  return highlightErrorsInPreview(html, checkResult.value.matches);
});

// --------------------
// Preview (simple)
/// -------------------
function escapeHtml(s: string) {
  return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

function renderPreviewTelegram(md: string) {
  let s = escapeHtml(md);
  s = s.replace(/```([\s\S]*?)```/g, (_m, c) => `<pre class="pv-pre"><code>${escapeHtml(c)}</code></pre>`);
  s = s.replace(/`([^`]+)`/g, `<code class="pv-code">$1</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a class="pv-link" href="$2" target="_blank" rel="noreferrer noopener">$1</a>`);
  s = s.replace(/\|\|([\s\S]*?)\|\|/g, `<span class="pv-spoiler">$1</span>`);
  s = s.replace(/\*\*([\s\S]*?)\*\*/g, "<b>$1</b>");
  s = s.replace(/__([\s\S]*?)__/g, "<u>$1</u>");
  s = s.replace(/~~([\s\S]*?)~~/g, "<s>$1</s>");
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>");
  s = s.replace(/^\s*&gt;\s?(.*)$/gm, `<blockquote class="pv-quote">$1</blockquote>`);
  s = s.replace(/\n/g, "<br/>");
  return s;
}

function renderPreviewWhatsApp(md: string) {
  let s = escapeHtml(md);
  s = s.replace(/```([\s\S]*?)```/g, (_m, c) => `<pre class="pv-pre"><code>${escapeHtml(c)}</code></pre>`);
  s = s.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  s = s.replace(/_([^_\n]+)_/g, "<i>$1</i>");
  s = s.replace(/~([^~\n]+)~/g, "<s>$1</s>");
  s = s.replace(/\n/g, "<br/>");
  return s;
}

function renderPreviewTikTok(md: string) {
  return escapeHtml(stripAllMarkdown(md)).replace(/\n/g, "<br/>");
}

const previewHtml = computed(() => {
  const md = outputText.value;
  if (activePlatform.value === "telegram") return renderPreviewTelegram(md);
  if (activePlatform.value === "whatsapp") return renderPreviewWhatsApp(md);
  return renderPreviewTikTok(md);
});

// --------------------
// Copy / clear / persist / check
// --------------------
async function copyOutput() {
  if (isTooLong.value) return;
  try {
    await navigator.clipboard.writeText(outputText.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 900);
  } catch {
    // ignore
  }
}

async function checkOutput() {
  if (!outputText.value) return

  checking.value = true
  checkResult.value = null

  try {
    const lang = locale.value.startsWith('ru') ? 'ru' : 'en'
    checkResult.value = await checkTextWithLanguageTool(outputText.value, lang)
  } catch (e) {
    console.error(e)
  } finally {
    checking.value = false
  }
}

function clearAll() {
  input.value = "";
  showEmoji.value = false;
  focusEditor();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);

    if (typeof p?.input === "string") input.value = p.input.slice(0, MAX);
    if (p?.platform === "telegram" || p?.platform === "whatsapp" || p?.platform === "tiktok") activePlatform.value = p.platform;
    if (p?.viewMode === "md" || p?.viewMode === "preview") viewMode.value = p.viewMode;
    if (typeof p?.spellcheckEnabled === "boolean") spellcheckEnabled.value = p.spellcheckEnabled;
  } catch {
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: input.value,
      platform: activePlatform.value,
      viewMode: viewMode.value,
      spellcheckEnabled: spellcheckEnabled.value
    }));
  } catch {
  }
}

watch(input, () => {
  clampToMax();
  saveState();
});
watch([activePlatform, viewMode, spellcheckEnabled], saveState);

// --------------------
// Hotkeys
// --------------------
function isMac() {
  if (process.server) return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function toggleEmojiHotkey() {
  showEmoji.value = !showEmoji.value;
}

function onKeydown(e: KeyboardEvent) {
  const el = inputRef.value;
  if (!el) return;
  if (document.activeElement !== el) return;

  const mod = isMac() ? e.metaKey : e.ctrlKey;

  if (mod && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "b") {
      e.preventDefault();
      wrapSelection("**");
      return;
    }
    if (k === "i") {
      e.preventDefault();
      wrapSelection("*");
      return;
    }
    if (k === "u") {
      e.preventDefault();
      wrapSelection("__");
      return;
    }
    if (k === "k") {
      e.preventDefault();
      openLinkModal();
      return;
    }
  }

  if (mod && e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "s") {
      e.preventDefault();
      wrapSelection("||");
      return;
    }
    if (k === "c") {
      e.preventDefault();
      toggleCodeBlock();
      return;
    }
    if (k === "q") {
      e.preventDefault();
      toggleQuote();
      return;
    }
    if (k === "8") {
      e.preventDefault();
      applyList("ul");
      return;
    }
    if (k === "7") {
      e.preventDefault();
      applyList("ol");
      return;
    }
    if (k === "l") {
      e.preventDefault();
      formatList();
      return;
    }
    if (k === "e") {
      e.preventDefault();
      toggleEmojiHotkey();
      return;
    }
  }
}

const platformTabsScroll = useTemplateRef<HTMLElement>("platformTabsScroll");
const platformTabIndex = computed(() => {
  const idx = platformTabs.value.findIndex((x: any) => x.value === activePlatform.value);
  return Math.max(0, idx);
});

function ensurePlatformTabVisible(index: number) {
  const wrap = platformTabsScroll.value;
  if (!wrap) return;

  const triggers = wrap.querySelectorAll<HTMLElement>(".tabs__trigger");
  const active = triggers[index];
  if (!active) return;

  const left = active.offsetLeft;
  const right = left + active.offsetWidth;
  const viewLeft = wrap.scrollLeft;
  const viewRight = wrap.scrollLeft + wrap.clientWidth;

  if (left < viewLeft) wrap.scrollTo({left: left - 16, behavior: "smooth"});
  else if (right > viewRight) wrap.scrollTo({left: right - wrap.clientWidth + 16, behavior: "smooth"});
}

async function onPlatformTabChange(value: PlatformId) {
  activePlatform.value = value;
  await nextTick();
  ensurePlatformTabVisible(platformTabIndex.value);
}

onMounted(async () => {
  loadState();
  await import("emoji-picker-element");
  await nextTick();
  window.addEventListener("keydown", onKeydown, {passive: false});
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown as any);
});
</script>

<template>
  <u-container class="markdown-editor">
    <div class="markdown-editor__header background-hero text-center space-y-3">
      <page-header
          title="services.markdownEditor.title"
          headline="services.markdownEditor.headline"
          description="services.markdownEditor.subtitle"
          class="mb-6"
          :is-centered="true"
      />
    </div>
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
  border-radius: 18px;
  border: 1px solid var(--ui-border);
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
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ui-text);
  font-weight: 900;
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
  font-weight: 900;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
}

.markdown-editor__counter_bad {
  color: var(--color-error, #ef4444);
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
}

.markdown-editor__emoji {
  margin-top: 10px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.markdown-editor__editor-wrap {
  margin-top: 12px;
}

.markdown-editor__editor {
  width: 100%;
  border-radius: 16px;
  padding: 12px 12px;
  border: 1px solid var(--ui-border);
  background: rgba(0, 0, 0, 0.12);
  color: var(--ui-text);
  outline: none;
  line-height: 1.55;
  resize: vertical;
  min-height: 260px;
  font-size: 14px;
}

.markdown-editor__editor:focus {
  box-shadow: 0 0 0 2px rgba(128, 90, 245, 0.30), 0 0 0 6px rgba(128, 90, 245, 0.14);
}

.markdown-editor__warning {
  margin-top: 10px;
  color: var(--color-error, #ef4444);
  font-weight: 800;
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
  font-weight: 900;
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
  box-shadow: 0 8px 20px rgba(128, 90, 245, .25);
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
  border-radius: 999px;
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
  border-radius: 999px;
  background: rgba(22, 24, 30, .75);
  color: rgba(255, 255, 255, .88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04), inset 0 -10px 20px rgba(0, 0, 0, .25);
  transition: background .2s ease, color .2s ease, box-shadow .2s ease;
  font-weight: 900;
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
  border-radius: 16px;
  padding: 12px 12px;
  border: 1px solid var(--ui-border);
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
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  overflow: auto;
}

.markdown-editor__preview :deep(.pv-quote) {
  margin: 8px 0;
  padding: 8px 10px;
  border-left: 3px solid rgba(128, 90, 245, 0.65);
  background: rgba(128, 90, 245, 0.08);
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
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(14, 12, 21, 0.92);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  padding: 16px;
}

.markdown-editor__modal-title {
  font-weight: 900;
  font-size: 16px;
  margin-bottom: 12px;
}

.markdown-editor__modal-grid {
  display: grid;
  gap: 12px;
}

.markdown-editor__modal-label {
  font-weight: 900;
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

.light .markdown-editor__card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px) saturate(180%);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.12),
  inset 0 1px 0 rgba(255, 255, 255, 0.65),
  inset 0 -4px 12px rgba(0, 0, 0, 0.06),
  inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

.light .markdown-editor__editor,
.light .markdown-editor__output,
.light .markdown-editor__preview {
  background: rgba(255, 255, 255, 0.65);
  color: rgba(21, 22, 42, 0.88);
  border-color: rgba(0, 0, 0, 0.08);
}

.light .markdown-editor__counter {
  background: rgba(255, 255, 255, 0.65);
  border-color: rgba(0, 0, 0, 0.08);
  color: rgba(21, 22, 42, 0.72);
}

.light :deep(.tabs__trigger) {
  background: rgba(255, 255, 255, 0.75);
  color: rgba(0, 0, 0, 0.75);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9),
  inset 0 -10px 18px rgba(0, 0, 0, 0.08),
  inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.light :deep(.tabs__trigger::before) {
  background: rgba(0, 0, 0, 0.06);
}

.light :deep(.tabs__trigger[data-state="active"]) {
  background: rgba(255, 255, 255, 0.95);
  color: rgba(0, 0, 0, 0.9);
}

.light :deep(.markdown-editor__modal) {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px) saturate(180%);
  border-color: rgba(0, 0, 0, 0.08);
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
  font-weight: 900;
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
