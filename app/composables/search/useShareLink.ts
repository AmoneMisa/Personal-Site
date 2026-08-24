export interface ShareLinkPayload {
  url: string;
  title: string;
  text?: string;
  key?: string;
}

export function useShareLink(feedbackMs = 2000) {
  const { copyText } = useClipboard();
  const copied = ref(false);
  const copiedKey = ref<string | null>(null);
  const fallbackOpen = ref(false);
  const fallbackUrl = ref("");
  const fallbackCopied = ref(false);
  let fallbackKey: string | undefined;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  function resetFeedback() {
    copied.value = false;
    copiedKey.value = null;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
  }

  function showSuccess(key?: string) {
    resetFeedback();
    copied.value = true;
    copiedKey.value = key || null;
    feedbackTimer = setTimeout(resetFeedback, feedbackMs);
  }

  async function share(payload: ShareLinkPayload, options: { native?: boolean; fallback?: boolean } = {}): Promise<boolean> {
    fallbackUrl.value = payload.url;
    fallbackCopied.value = false;
    fallbackKey = payload.key;
    const native = options.native ?? true;
    if (native && import.meta.client && navigator.share) {
      const shareData = { title: payload.title, text: payload.text ?? payload.title, url: payload.url };
      if (!navigator.canShare || navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          showSuccess(payload.key);
          return true;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return false;
        }
      }
    }
    fallbackCopied.value = await copyText(payload.url);
    if (fallbackCopied.value) {
      showSuccess(payload.key);
      return true;
    }
    if (options.fallback ?? true) fallbackOpen.value = true;
    return false;
  }

  async function copyFallback() {
    fallbackCopied.value = await copyText(fallbackUrl.value);
    if (fallbackCopied.value) showSuccess(fallbackKey);
  }

  onBeforeUnmount(resetFeedback);
  return { copied, copiedKey, fallbackOpen, fallbackUrl, fallbackCopied, share, copyFallback, resetFeedback };
}
