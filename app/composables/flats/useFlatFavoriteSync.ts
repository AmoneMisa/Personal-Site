import type { FlatListing } from "~/types/flats";
import { flatListingKey } from "~/utils/flats/listingKey";
import { safeFetch } from "~/utils/safeFetch";

/**
 * Favourites sync for the browser.
 *
 * Talks to the saved-state proxy routes (server/routes/flats-sync-*), which
 * hold this browser's installation credentials in httpOnly cookies. The
 * installation is per-browser: it makes favourites survive a cleared
 * localStorage and stay consistent across tabs. It does NOT yet join a phone
 * and a browser — that needs the account/pairing work, where the agreed rule
 * is a union merge, which is why merging here never deletes either side.
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

  /** Remote favourites, or null when sync is unavailable. */
  async function pull(): Promise<FlatListing[] | null> {
    const { data, error } = await safeFetch<RemoteState>("/flats-sync-state");
    if (error || !data?.ok || !data.state) {
      live.value = false;
      return null;
    }
    return listingsFrom(data.state.favorites);
  }

  /** Seed a fresh installation from what this browser already had. */
  async function seed(favorites: FlatListing[]): Promise<void> {
    if (!live.value || !favorites.length) return;
    const { error } = await safeFetch("/flats-sync-import", {
      method: "POST",
      body: { favorites: favorites.map((listing) => ({ key: flatListingKey(listing), listing })) },
    });
    if (error) live.value = false;
  }

  async function mutate(op: string, listing: FlatListing): Promise<void> {
    if (!live.value) return;
    const body: Record<string, unknown> = { op, itemKey: flatListingKey(listing) };
    // Deletes carry the key only; the payload is what the server stores.
    if (op === "favorite.put") body.listing = listing;
    const { error } = await safeFetch("/flats-sync-mutate", { method: "POST", body });
    if (error) live.value = false;
  }

  const add = (listing: FlatListing) => mutate("favorite.put", listing);
  const remove = (listing: FlatListing) => mutate("favorite.delete", listing);

  return { live, pull, seed, add, remove };
}
