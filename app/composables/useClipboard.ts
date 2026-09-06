export function useClipboard() {
  async function copyText(value: string): Promise<boolean> {
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return { copyText };
}
