import { computed, shallowRef } from "vue";
import { readStoredList, writeStoredList } from "~/utils/browserStorage";
import { useAccountLists, type AccountListDomain } from "~/composables/useAccountLists";

interface SavedCollectionOptions<T> {
  namespace: string;
  getId: (item: T) => string;
  favoritesLimit?: number;
  hiddenLimit?: number;
  recentLimit?: number;
  storageVersion?: number;
  /**
   * Keep these lists with the site's Google account while signed in
   * (useAccountLists). Items are stored whole, keyed by getId.
   */
  accountSync?: { domain: AccountListDomain; lists: Array<"favorites" | "hidden" | "recent"> };
}

export function useSavedCollections<T>(options: SavedCollectionOptions<T>) {
  const version = options.storageVersion ?? 1;
  const keys = {
    favorites: `${options.namespace}:favorites:v${version}`,
    hidden: `${options.namespace}:hidden:v${version}`,
    recent: `${options.namespace}:recent:v${version}`,
  };
  const latestRecent = useState<T | null>(`${options.namespace}:latest-recent:v${version}`, () => null);
  const favoritesLimit = options.favoritesLimit ?? 200;
  const hiddenLimit = options.hiddenLimit ?? 200;
  const recentLimit = options.recentLimit ?? 30;
  const favorites = shallowRef<T[]>([]);
  const hidden = shallowRef<T[]>([]);
  const recent = shallowRef<T[]>([]);
  const favoriteIds = computed(() => new Set(favorites.value.map(options.getId)));
  const hiddenIds = computed(() => new Set(hidden.value.map(options.getId)));

  function persistFavorites() {
    writeStoredList(keys.favorites, favorites.value, favoritesLimit);
  }

  function persistHidden() {
    writeStoredList(keys.hidden, hidden.value, hiddenLimit);
  }

  function persistRecent() {
    writeStoredList(keys.recent, recent.value, recentLimit);
  }

  function upsert(list: T[], item: T, limit: number): T[] {
    const id = options.getId(item);
    return [item, ...list.filter((entry) => options.getId(entry) !== id)].slice(0, limit);
  }

  const account = options.accountSync ? useAccountLists(options.accountSync.domain) : null;
  const synced = (list: "favorites" | "hidden" | "recent") => Boolean(account && options.accountSync?.lists.includes(list));
  const lists = {
    favorites: { ref: favorites, limit: favoritesLimit, persist: persistFavorites },
    hidden: { ref: hidden, limit: hiddenLimit, persist: persistHidden },
    recent: { ref: recent, limit: recentLimit, persist: persistRecent },
  };
  let accountStarted = false;

  /** Tells the account about one item's membership in a synced list. */
  function pushMembership(list: "favorites" | "hidden" | "recent", item: T, member: boolean) {
    if (!synced(list)) return;
    const id = options.getId(item);
    if (member) account!.put(list, id, item);
    else account!.remove(list, id);
  }

  function startAccountSync() {
    if (!account || accountStarted) return;
    accountStarted = true;
    for (const list of options.accountSync!.lists) {
      const entry = lists[list];
      account.syncList<T>(list, {
        read: () => entry.ref.value,
        write: (items) => {
          entry.ref.value = items;
          entry.persist();
        },
        keyOf: options.getId,
        toPayload: (item) => item,
        fromPayload: (row) => (row.payload && typeof row.payload === "object" ? row.payload as T : null),
        limit: entry.limit,
      });
    }
  }

  function load() {
    favorites.value = readStoredList<T>(keys.favorites, favoritesLimit);
    hidden.value = readStoredList<T>(keys.hidden, hiddenLimit);
    recent.value = readStoredList<T>(keys.recent, recentLimit);
    // After the local copy is in place, so a first sync merges it.
    startAccountSync();
  }

  function isFavorite(id: string) {
    return favoriteIds.value.has(id);
  }

  function isHidden(id: string) {
    return hiddenIds.value.has(id);
  }

  function toggleFavorite(item: T) {
    const id = options.getId(item);
    const adding = !isFavorite(id);
    favorites.value = adding
      ? upsert(favorites.value, item, favoritesLimit)
      : favorites.value.filter((entry) => options.getId(entry) !== id);
    if (isHidden(id)) {
      hidden.value = hidden.value.filter((entry) => options.getId(entry) !== id);
      persistHidden();
      pushMembership("hidden", item, false);
    }
    persistFavorites();
    pushMembership("favorites", item, adding);
  }

  function toggleHidden(item: T) {
    const id = options.getId(item);
    const hiding = !isHidden(id);
    hidden.value = hiding
      ? upsert(hidden.value, item, hiddenLimit)
      : hidden.value.filter((entry) => options.getId(entry) !== id);
    if (isFavorite(id)) {
      favorites.value = favorites.value.filter((entry) => options.getId(entry) !== id);
      persistFavorites();
      pushMembership("favorites", item, false);
    }
    persistHidden();
    pushMembership("hidden", item, hiding);
  }

  function addRecent(item: T) {
    recent.value = upsert(recent.value, item, recentLimit);
    latestRecent.value = item;
    persistRecent();
    pushMembership("recent", item, true);
  }

  /**
   * Union-merge items in, keeping what this browser already had first and
   * dropping duplicates. Used when sync pulls a remote list: the two sides are
   * combined rather than one overwriting the other.
   */
  function mergeFavorites(items: T[]): T[] {
    const seen = new Set(favorites.value.map(options.getId));
    const extras = items.filter((item) => !seen.has(options.getId(item)));
    if (!extras.length) return [];
    favorites.value = [...favorites.value, ...extras].slice(0, favoritesLimit);
    persistFavorites();
    return extras;
  }

  /** Drops every favourite, e.g. when they leave with a signed-out account. */
  function clearFavorites() {
    favorites.value = [];
    persistFavorites();
  }

  function removeWhere(predicate: (item: T) => boolean) {
    for (const list of ["favorites", "hidden", "recent"] as const) {
      for (const item of lists[list].ref.value) if (predicate(item)) pushMembership(list, item, false);
    }
    favorites.value = favorites.value.filter((item) => !predicate(item));
    hidden.value = hidden.value.filter((item) => !predicate(item));
    recent.value = recent.value.filter((item) => !predicate(item));
    persistFavorites();
    persistHidden();
    persistRecent();
  }

  return {
    favorites,
    hidden,
    recent,
    latestRecent,
    favoriteIds,
    hiddenIds,
    isHidden,
    isFavorite,
    toggleFavorite,
    toggleHidden,
    addRecent,
    mergeFavorites,
    clearFavorites,
    removeWhere,
    load,
  };
}
