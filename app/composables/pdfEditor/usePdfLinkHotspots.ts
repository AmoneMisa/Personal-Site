import { computed, ref, type Ref } from "vue";
import type { PdfLinkRegion } from "~/types/pdfEditor";

interface PdfLinkHotspotsOptions {
  page: Ref<number>;
  pageLinks: Record<number, PdfLinkRegion[]>;
}

export function usePdfLinkHotspots({ page, pageLinks }: PdfLinkHotspotsOptions) {
  const displayScale = ref(1);
  const linkArmed = ref(false);

  const linkHotspots = computed(() => {
    const scale = displayScale.value || 1;
    return (pageLinks[page.value] || []).map((link, index) => ({
      key: `${page.value}_${index}`,
      uri: link.uri,
      left: link.x * scale,
      top: link.y * scale,
      width: Math.max(6, link.w * scale),
      height: Math.max(6, link.h * scale),
    }));
  });

  function openLink(uri: string): void {
    if (uri) window.open(uri, "_blank", "noopener,noreferrer");
  }

  function onModifierKey(event: KeyboardEvent): void {
    linkArmed.value = event.ctrlKey || event.metaKey;
  }

  function clearLinkArmed(): void {
    linkArmed.value = false;
  }

  return {
    clearLinkArmed,
    displayScale,
    linkArmed,
    linkHotspots,
    onModifierKey,
    openLink,
  };
}
