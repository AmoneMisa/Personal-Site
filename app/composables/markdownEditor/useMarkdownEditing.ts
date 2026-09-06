import {nextTick, onBeforeUnmount, onMounted, ref, type Ref} from "vue";
import {sanitizeMarkdownUrl} from "~/utils/markdownEditor/platformFormatters";

export function useMarkdownEditing(
  input: Ref<string>,
  inputRef: Ref<HTMLTextAreaElement | null>,
  showEmoji: Ref<boolean>,
) {
  const linkOpen = ref(false);
  const linkText = ref("");
  const linkUrl = ref("https://");
  const linkSelection = {start: 0, end: 0};

  function focusEditor() {
    requestAnimationFrame(() => inputRef.value?.focus());
  }

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      inputRef.value?.focus();
      inputRef.value?.setSelectionRange(start, end);
    });
  }

  function insertAtCursor(text: string) {
    const element = inputRef.value;
    if (!element) return;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    restoreSelection(start + text.length, start + text.length);
  }

  function wrapSelection(left: string, right = left) {
    const element = inputRef.value;
    if (!element) return;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const before = input.value.slice(0, start);
    const selected = input.value.slice(start, end);
    const after = input.value.slice(end);

    if (before.endsWith(left) && after.startsWith(right)) {
      input.value = before.slice(0, -left.length) + selected + after.slice(right.length);
      restoreSelection(start - left.length, end - left.length);
      return;
    }

    input.value = before + left + selected + right + after;
    const cursorStart = start + left.length;
    restoreSelection(cursorStart, selected.length ? end + left.length : cursorStart);
  }

  function selectedLines() {
    const element = inputRef.value;
    if (!element) return null;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const lineStart = input.value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = input.value.indexOf("\n", end);
    const realEnd = lineEnd === -1 ? input.value.length : lineEnd;
    return {
      lineStart,
      before: input.value.slice(0, lineStart),
      block: input.value.slice(lineStart, realEnd),
      after: input.value.slice(realEnd),
    };
  }

  function replaceSelectedLines(transform: (lines: string[]) => string[]) {
    const selection = selectedLines();
    if (!selection) return;
    const nextBlock = transform(selection.block.split("\n")).join("\n");
    input.value = selection.before + nextBlock + selection.after;
    restoreSelection(selection.lineStart, selection.lineStart + nextBlock.length);
  }

  function toggleQuote() {
    replaceSelectedLines((lines) => {
      const allQuoted = lines.every((line) => line.startsWith("> "));
      return allQuoted
        ? lines.map((line) => line.replace(/^>\s/, ""))
        : lines.map((line) => line.trim() ? `> ${line}` : line);
    });
  }

  function toggleCodeBlock() {
    const element = inputRef.value;
    if (!element) return;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const selected = input.value.slice(start, end);
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const fence = "```";

    if (before.endsWith(`${fence}\n`) && after.startsWith(`\n${fence}`)) {
      input.value = before.slice(0, -(fence.length + 1)) + selected + after.slice(fence.length + 1);
      restoreSelection(start - fence.length - 1, end - fence.length - 1);
      return;
    }

    const content = selected || "text";
    input.value = before + `${fence}\n${content}\n${fence}` + after;
    const innerStart = start + fence.length + 1;
    restoreSelection(innerStart, innerStart + content.length);
  }

  function applyList(kind: "ul" | "ol") {
    replaceSelectedLines((lines) => {
      let number = 1;
      return lines.map((line) => {
        const raw = line.trimEnd();
        if (!raw.trim()) return raw;
        const cleaned = raw.replace(/^(\s*)([-*•]|\d+\.)\s+/, "$1").trimStart();
        return kind === "ul" ? `- ${cleaned}` : `${number++}. ${cleaned}`;
      });
    });
  }

  function formatList() {
    const selection = selectedLines();
    if (!selection) return;
    const lines = selection.block.split("\n");
    const numbered = lines.filter((line) => /^\s*\d+\.\s+/.test(line)).length;
    const bulleted = lines.filter((line) => /^\s*[-*•]\s+/.test(line)).length;
    const kind = numbered > bulleted ? "ol" : "ul";
    let number = 1;
    const nextBlock = lines.map((line) => {
      const raw = line.trimEnd();
      if (!raw.trim()) return raw;
      const match = raw.match(/^(\s*)(.*)$/);
      const indent = match?.[1] ?? "";
      const content = (match?.[2] ?? "").replace(/^(\s*)([-*•]|\d+\.)\s+/, "$1").trimStart();
      return kind === "ul" ? `${indent}- ${content}` : `${indent}${number++}. ${content}`;
    }).join("\n");
    input.value = selection.before + nextBlock + selection.after;
    restoreSelection(selection.lineStart, selection.lineStart + nextBlock.length);
  }

  function openLinkModal() {
    const element = inputRef.value;
    if (!element) return;
    linkSelection.start = element.selectionStart ?? 0;
    linkSelection.end = element.selectionEnd ?? 0;
    linkText.value = input.value.slice(linkSelection.start, linkSelection.end);
    linkUrl.value = "https://";
    linkOpen.value = true;
  }

  async function insertLinkConfirmed() {
    const text = (linkText.value || input.value.slice(linkSelection.start, linkSelection.end) || "link").trim();
    const url = linkUrl.value.trim();
    if (!url || !sanitizeMarkdownUrl(url)) return;
    const snippet = `[${text}](${url})`;
    input.value = input.value.slice(0, linkSelection.start) + snippet + input.value.slice(linkSelection.end);
    linkOpen.value = false;
    await nextTick();
    restoreSelection(linkSelection.start, linkSelection.start + snippet.length);
  }

  function onEmoji(event: any) {
    const emoji = event?.detail?.unicode;
    if (emoji) insertAtCursor(emoji);
  }

  function isMac() {
    return import.meta.client && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  }

  function onKeydown(event: KeyboardEvent) {
    if (!inputRef.value || document.activeElement !== inputRef.value) return;
    const modifier = isMac() ? event.metaKey : event.ctrlKey;
    const key = event.key.toLowerCase();

    const command = !event.shiftKey && !event.altKey && ({
      b: () => wrapSelection("**"),
      i: () => wrapSelection("*"),
      u: () => wrapSelection("__"),
      k: openLinkModal,
    } as Record<string, () => void>)[key];

    const shiftedCommand = event.shiftKey && !event.altKey && ({
      s: () => wrapSelection("||"),
      c: toggleCodeBlock,
      q: toggleQuote,
      "8": () => applyList("ul"),
      "7": () => applyList("ol"),
      l: formatList,
      e: () => { showEmoji.value = !showEmoji.value; },
    } as Record<string, () => void>)[key];

    const handler = modifier ? command || shiftedCommand : undefined;
    if (!handler) return;
    event.preventDefault();
    handler();
  }

  onMounted(() => window.addEventListener("keydown", onKeydown, {passive: false}));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

  return {
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
  };
}
