export function useClipboard() {
  async function copyText(value: string): Promise<boolean> {
    if (!import.meta.client) return false;
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch { /* fall through to the legacy copy path */ }
    }

    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } finally { field.remove(); }
    return copied;
  }

  return { copyText };
}
