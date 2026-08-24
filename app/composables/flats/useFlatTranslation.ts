import { computed, ref, type Ref } from "vue";
import type { FlatListing, FlatTranslationResult } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";

export function useFlatTranslation(active: Ref<FlatListing | null>, locale: Ref<string>) {
  const translatedDescription = ref("");
  const translatingDescription = ref(false);
  const translationFailed = ref(false);
  const cache = new Map<string, string>();
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;
  const maxPollAttempts = 159;

  const targetLanguage = () => locale.value.startsWith("en") ? "en" as const : "ru" as const;
  const cacheKey = (listing: FlatListing, target = targetLanguage()) => `${listing.id}:${target}`;

  function descriptionMatchesTargetLanguage(text: string, target: "en" | "ru"): boolean {
    const normalized = text.toLocaleLowerCase();
    if (target === "ru") {
      if (/[ўқғҳ]/iu.test(normalized)) return false;
      const signals = normalized.match(/(?:квартир\p{L}*|комнат\p{L}*|этаж\p{L}*|дом\p{L}*|цен\p{L}*|сда[её]тся|прода[её]тся|аренд\p{L}*|рядом|метро|семейн\p{L}*|коммунальн\p{L}*)/giu) || [];
      return signals.length >= 2;
    }
    const vocabulary = new Set(["apartment", "flat", "house", "room", "floor", "price", "rent", "sale", "family", "utilities", "near", "available", "bedroom"]);
    return (normalized.match(/[a-z]+/g) || []).filter((word) => vocabulary.has(word)).length >= 3;
  }

  const descriptionNeedsTranslation = computed(() => {
    const description = active.value?.description?.trim();
    return !!description && !descriptionMatchesTargetLanguage(description, targetLanguage());
  });

  function stopPoll() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = undefined;
  }

  function cancelTranslation() {
    stopPoll();
    requestId += 1;
    translatingDescription.value = false;
  }

  function prepareTranslation(listing: FlatListing) {
    cancelTranslation();
    translatedDescription.value = cache.get(cacheKey(listing)) || "";
    translationFailed.value = false;
  }

  function accept(result: FlatTranslationResult, listing: FlatListing, id: number, key: string): boolean {
    if (id !== requestId || active.value?.id !== listing.id) return true;
    if (result.status !== "completed") return false;
    const text = result.data?.translatedText?.trim() || "";
    if (!text) {
      translatingDescription.value = false;
      translationFailed.value = true;
      return true;
    }
    cache.set(key, text);
    translatedDescription.value = text;
    translatingDescription.value = false;
    translationFailed.value = false;
    return true;
  }

  async function poll(key: string, listing: FlatListing, id: number, listingCacheKey: string, attempt = 0) {
    if (id !== requestId || active.value?.id !== listing.id) return;
    const { data, error } = await safeFetch<FlatTranslationResult>("/flats-translate", { params: { key } });
    if (id !== requestId || active.value?.id !== listing.id) return;
    if (!error && data && accept(data, listing, id, listingCacheKey)) return;
    if (error || data?.status === "failed" || data?.status === "disabled" || data?.status === "not_found" || attempt >= maxPollAttempts) {
      translatingDescription.value = false;
      translationFailed.value = true;
      return;
    }
    pollTimer = setTimeout(() => void poll(key, listing, id, listingCacheKey, attempt + 1), 1500);
  }

  async function translateActiveDescription() {
    const listing = active.value;
    if (!listing?.description || translatingDescription.value || !descriptionNeedsTranslation.value) return;
    const target = targetLanguage();
    const listingCacheKey = cacheKey(listing, target);
    const cached = cache.get(listingCacheKey);
    if (cached) {
      translatedDescription.value = cached;
      return;
    }
    stopPoll();
    const id = ++requestId;
    translatingDescription.value = true;
    translationFailed.value = false;
    const { data, error } = await safeFetch<FlatTranslationResult>("/flats-translate", {
      method: "POST",
      body: { text: listing.description, targetLanguage: target },
    });
    if (id !== requestId || active.value?.id !== listing.id) return;
    if (error || !data) {
      translatingDescription.value = false;
      translationFailed.value = true;
      return;
    }
    if (accept(data, listing, id, listingCacheKey)) return;
    if (data.status === "pending" && data.key) {
      pollTimer = setTimeout(() => void poll(data.key!, listing, id, listingCacheKey), 1000);
      return;
    }
    translatingDescription.value = false;
    translationFailed.value = true;
  }

  return {
    translatedDescription,
    translatingDescription,
    translationFailed,
    descriptionNeedsTranslation,
    prepareTranslation,
    cancelTranslation,
    translateActiveDescription,
  };
}
