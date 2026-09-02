import { ref } from "vue";
import type { FlatListing } from "~/types/flats";

export function useFlatPhotos() {
  const failedPhotoUrls = ref<Set<string>>(new Set());

  function photoCandidates(listing: FlatListing): string[] {
    return [...new Set([listing.photo, ...(listing.photos || [])].filter((value): value is string => !!value))];
  }

  function listingPhoto(listing: FlatListing): string | null {
    return photoCandidates(listing).find((url) => !failedPhotoUrls.value.has(url)) || null;
  }

  function visiblePhotos(listing: FlatListing): string[] {
    return photoCandidates(listing).filter((url) => !failedPhotoUrls.value.has(url));
  }

  function markPhotoFailed(url: string | null) {
    if (!url) return;
    failedPhotoUrls.value = new Set([...failedPhotoUrls.value, url]);
  }

  function markPhotoFailedFromEvent(event: Event) {
    markPhotoFailed((event.currentTarget as HTMLImageElement | null)?.getAttribute("src") || null);
  }

  return { failedPhotoUrls, photoCandidates, listingPhoto, visiblePhotos, markPhotoFailed, markPhotoFailedFromEvent };
}
