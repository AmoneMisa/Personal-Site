import { computed, shallowRef } from "vue";
import type { FlatListing } from "~/types/flats";
import { readStoredList, writeStoredList } from "~/utils/browserStorage";

/**
 * User-made listing collections ("подборки").
 *
 * Deliberately the same shape as the Flutter app's SortedCollection
 * (flat-finder app/lib/state/sorted.dart) and the backend's
 * user_data.saved_collections rows with kind='sorted', so these can later sync
 * through /api/mobile/saved-state without a migration or a format change:
 *   { id, title, isPreset, presetName?, items: [...] }
 *
 * Browser-local for now (localStorage), like favorites and hidden.
 */
export interface FlatCollection {
  id: string;
  title: string;
  isPreset: boolean;
  presetName?: string;
  items: FlatListing[];
}

// The backend caps these (MAX_SORTED_COLLECTIONS / MAX_SORTED_ITEMS in
// apps/flats/src/mobile/mobile-saved-state.js). Matching them here means a
// collection built on the web cannot be rejected when sync arrives.
export const MAX_COLLECTIONS = 100;
export const MAX_ITEMS_PER_COLLECTION = 500;
const MAX_TITLE_LENGTH = 160;

const STORAGE_KEY = "flats:collections:v1";

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Trims to the backend's column width; empty titles get a fallback. */
export function cleanCollectionTitle(value: string, fallback: string): string {
  return String(value ?? "").trim().slice(0, MAX_TITLE_LENGTH) || fallback;
}

/** Tolerates hand-edited or partially-synced storage. */
function parseCollection(value: unknown): FlatCollection | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    title: String(raw.title ?? "").slice(0, MAX_TITLE_LENGTH),
    isPreset: raw.isPreset === true,
    presetName: raw.presetName == null ? undefined : String(raw.presetName),
    items: Array.isArray(raw.items) ? (raw.items.filter(Boolean) as FlatListing[]) : [],
  };
}

export function useFlatCollections() {
  const collections = shallowRef<FlatCollection[]>([]);
  const loaded = shallowRef(false);

  function persist() {
    writeStoredList(STORAGE_KEY, collections.value, MAX_COLLECTIONS);
  }

  function load() {
    if (!import.meta.client) return;
    collections.value = readStoredList<unknown>(STORAGE_KEY, MAX_COLLECTIONS)
      .map(parseCollection)
      .filter((item): item is FlatCollection => item !== null);
    loaded.value = true;
  }

  function byId(id: string): FlatCollection | undefined {
    return collections.value.find((item) => item.id === id);
  }

  function create(title: string, fallbackTitle: string): FlatCollection | null {
    if (collections.value.length >= MAX_COLLECTIONS) return null;
    const collection: FlatCollection = {
      id: newId(),
      title: cleanCollectionTitle(title, fallbackTitle),
      isPreset: false,
      items: [],
    };
    collections.value = [collection, ...collections.value];
    persist();
    return collection;
  }

  function rename(id: string, title: string, fallbackTitle: string) {
    collections.value = collections.value.map((item) =>
      item.id === id ? { ...item, title: cleanCollectionTitle(title, fallbackTitle) } : item,
    );
    persist();
  }

  function remove(id: string) {
    collections.value = collections.value.filter((item) => item.id !== id);
    persist();
  }

  /** Newest first, and never duplicated: re-adding moves it to the top. */
  function addItem(id: string, listing: FlatListing) {
    collections.value = collections.value.map((item) => {
      if (item.id !== id) return item;
      const items = [listing, ...item.items.filter((entry) => entry.id !== listing.id)];
      return { ...item, items: items.slice(0, MAX_ITEMS_PER_COLLECTION) };
    });
    persist();
  }

  function removeItem(id: string, listingId: string) {
    collections.value = collections.value.map((item) =>
      item.id === id ? { ...item, items: item.items.filter((entry) => entry.id !== listingId) } : item,
    );
    persist();
  }

  function has(id: string, listingId: string): boolean {
    return byId(id)?.items.some((entry) => entry.id === listingId) ?? false;
  }

  /** Which collections a listing already sits in, for the picker's checkmarks. */
  const idsByListing = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const collection of collections.value) {
      for (const item of collection.items) {
        const set = map.get(item.id) ?? new Set<string>();
        set.add(collection.id);
        map.set(item.id, set);
      }
    }
    return map;
  });

  const isFull = computed(() => collections.value.length >= MAX_COLLECTIONS);

  return {
    collections,
    loaded,
    isFull,
    idsByListing,
    load,
    byId,
    create,
    rename,
    remove,
    addItem,
    removeItem,
    has,
  };
}
