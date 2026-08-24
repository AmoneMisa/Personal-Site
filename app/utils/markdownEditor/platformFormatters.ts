export type MarkdownPlatform = "telegram" | "whatsapp" | "tiktok";

export function stripAllMarkdown(raw: string) {
  return raw
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|\|([\s\S]*?)\|\|/g, "$1")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/~~([\s\S]*?)~~/g, "$1")
    .replace(/\*([\s\S]*?)\*/g, "$1");
}

function toWhatsApp(raw: string) {
  return raw
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\|\|([\s\S]*?)\|\|/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "```$1```")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "_$1_")
    .replace(/\*\*([\s\S]*?)\*\*/g, "*$1*")
    .replace(/~~([\s\S]*?)~~/g, "~$1~");
}

export function formatPlatformText(raw: string, platform: MarkdownPlatform) {
  if (platform === "telegram") return raw;
  if (platform === "whatsapp") return toWhatsApp(raw);
  return stripAllMarkdown(raw);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTelegram(markdown: string) {
  return escapeHtml(markdown)
    .replace(/```([\s\S]*?)```/g, (_match, code) => `<pre class="pv-pre"><code>${escapeHtml(code)}</code></pre>`)
    .replace(/`([^`]+)`/g, `<code class="pv-code">$1</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a class="pv-link" href="$2" target="_blank" rel="noreferrer noopener">$1</a>`)
    .replace(/\|\|([\s\S]*?)\|\|/g, `<span class="pv-spoiler">$1</span>`)
    .replace(/\*\*([\s\S]*?)\*\*/g, "<b>$1</b>")
    .replace(/__([\s\S]*?)__/g, "<u>$1</u>")
    .replace(/~~([\s\S]*?)~~/g, "<s>$1</s>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>")
    .replace(/^\s*&gt;\s?(.*)$/gm, `<blockquote class="pv-quote">$1</blockquote>`)
    .replace(/\n/g, "<br/>");
}

function renderWhatsApp(markdown: string) {
  return escapeHtml(markdown)
    .replace(/```([\s\S]*?)```/g, (_match, code) => `<pre class="pv-pre"><code>${escapeHtml(code)}</code></pre>`)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/_([^_\n]+)_/g, "<i>$1</i>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>")
    .replace(/\n/g, "<br/>");
}

export function renderPlatformPreview(markdown: string, platform: MarkdownPlatform) {
  if (platform === "telegram") return renderTelegram(markdown);
  if (platform === "whatsapp") return renderWhatsApp(markdown);
  return escapeHtml(stripAllMarkdown(markdown)).replace(/\n/g, "<br/>");
}

export function highlightLanguageMatches(html: string, matches: any[]) {
  const text = html.replace(/<[^>]+>/g, "");
  let result = "";
  let lastIndex = 0;

  for (const match of matches) {
    const start = match.offset;
    const end = match.offset + match.length;
    const category = match.rule?.category?.id || "";
    let className = "lt-error-generic";

    if (category.includes("TYPOS")) className = "lt-error-typo";
    else if (category.includes("GRAMMAR")) className = "lt-error-grammar";
    else if (category.includes("PUNCTUATION")) className = "lt-error-punct";
    else if (category.includes("STYLE")) className = "lt-error-style";

    result += text.slice(lastIndex, start);
    result += `<mark class="${className}">${text.slice(start, end)}</mark>`;
    lastIndex = end;
  }

  return `${result}${text.slice(lastIndex)}`.replace(/\n/g, "<br/>");
}
