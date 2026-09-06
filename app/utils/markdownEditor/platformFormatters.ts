export type MarkdownPlatform = "telegram" | "whatsapp" | "tiktok";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function decodeEscapedUrl(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Returns the escaped URL only when it is safe to place in an href. */
export function sanitizeMarkdownUrl(value: string): string | null {
  const decoded = decodeEscapedUrl(value);
  if (!decoded || Array.from(decoded).some((character) => character <= " " || character.charCodeAt(0) === 127)) {
    return null;
  }

  try {
    const parsed = new URL(decoded);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? value : null;
  } catch {
    return null;
  }
}

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
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = sanitizeMarkdownUrl(href);
      return safeHref
        ? `<a class="pv-link" href="${safeHref}" target="_blank" rel="noreferrer noopener">${label}</a>`
        : `${label} (${href})`;
    })
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

type LanguageToolMatch = {
  offset?: number;
  length?: number;
  rule?: { category?: { id?: string } };
};

export function highlightLanguageMatches(html: string, matches: LanguageToolMatch[]) {
  const text = html.replace(/<[^>]+>/g, "");
  let result = "";
  let lastIndex = 0;

  const validMatches = matches
    .map((match) => ({
      start: Number(match.offset),
      length: Number(match.length),
      category: String(match.rule?.category?.id || ""),
    }))
    .filter((match) => Number.isFinite(match.start) && Number.isFinite(match.length) && match.length > 0)
    .sort((left, right) => left.start - right.start);

  for (const match of validMatches) {
    const start = Math.max(lastIndex, Math.min(text.length, match.start));
    const end = Math.max(start, Math.min(text.length, start + match.length));
    if (start >= end) continue;
    const category = match.category;
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
