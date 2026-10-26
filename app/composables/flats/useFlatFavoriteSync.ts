import type { FlatListing } from "~/types/flats";
import { flatListingKey } from "~/utils/flats/listingKey";
import { safeFetch } from "~/utils/safeFetch";
import { onScopeDispose, ref } from "vue";

/**
 * Favourites sync for the browser.
 *
 * Talks to the saved-state proxy routes (server/routes/flats-sync-*), which
 * hold this browser's installation credentials in httpOnly cookies. The
 * proxy selects the account or browser installation from the current session.
 * The initial union merge preserves favourites from both sides; in-flight
 * work belongs to that session and is discarded when it ends.
 *
 * Hidden and recently-viewed are deliberately not synced: the backend's
 * saved_collections.kind only allows 'favorites' and 'sorted'.
 *
 * Sync is an enhancement, never a requirement. Every call degrades to "keep
 * working locally" — the page must stay usable with the API down.
 */

interface RemoteItem {
  key?: string;
  listing?: FlatListing;
}

interface RemoteState {
  ok: boolean;
  state: { favorites?: RemoteItem[] } | null;
}

function listingsFrom(items: RemoteItem[] | undefined): FlatListing[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => item?.listing)
    .filter((listing): listing is FlatListing => Boolean(listing?.id && listing?.source));
}

export function useFlatFavoriteSync() {
  // One failure switches pushes off for the rest of the page's life: if the
  // API is unavailable, retrying on every heart click just stalls the UI.
  const live = ref(true);
  const pending = new Set<AbortController>();
  let generation = 0;

  function cancelPending() {
    generation += 1;
    for (const controller of pending) controller.abort();
    pending.clear();
    live.value = true;
  }

  async function request<T>(url: string, options: Parameters<typeof safeFetch>[1] = {}) {
    const current = generation;
    const controller = new AbortController();
    pending.add(controller);
    try {
      const result = await safeFetch<T>(url, { ...options, signal: controller.signal });
      return current === generation ? result : null;
    } finally {
      pending.delete(controller);
    }
  }

  onScopeDispose(cancelPending);

  /** Remote favourites, or null when sync is unavailable. */
  async function pull(): Promise<FlatListing[] | null> {
    const result = await request<RemoteState>("/flats-sync-state");
    if (!result) return null;
    const { data, error } = result;
    if (error || !data?.ok || !data.state) {
      live.value = false;
      return null;
    }
    return listingsFrom(data.state.favorites);
  }

  /**
   * Push favourites the server does not have yet, in one request. The
   * backend's import only adds, so this never overwrites the server side.
   */
  async function seed(favorites: FlatListing[]): Promise<void> {
    if (!live.value || !favorites.length) return;
    const result = await request("/flats-sync-import", {
      method: "POST",
      body: { favorites: favorites.map((listing) => ({ key: flatListingKey(listing), listing })) },
    });
    if (result?.error) live.value = false;
  }

  async function mutate(op: string, listing: FlatListing): Promise<void> {
    if (!live.value) return;
    const body: Record<string, unknown> = { op, itemKey: flatListingKey(listing) };
    // Deletes carry the key only; the payload is what the server stores.
    if (op === "favorite.put") body.listing = listing;
    const result = await request("/flats-sync-mutate", { method: "POST", body });
    if (result?.error) live.value = false;
  }

  async function synchronize(local: FlatListing[], merge: (remote: FlatListing[]) => unknown) {
    const current = generation;
    const before = local.slice();
    const remote = await pull();
    if (!remote || current !== generation) return;
    merge(remote);
    const remoteIds = new Set(remote.map((listing) => listing.id));
    await seed(before.filter((listing) => !remoteIds.has(listing.id)));
  }

  const add = (listing: FlatListing) => mutate("favorite.put", listing);
  const remove = (listing: FlatListing) => mutate("favorite.delete", listing);

  return { live, pull, seed, add, remove, synchronize, cancelPending };
}
