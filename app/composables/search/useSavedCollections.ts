import { computed, shallowRef } from "vue";
import { readStoredList, writeStoredList } from "~/utils/browserStorage";

interface SavedCollectionOptions<T> {
  namespace: string;
  getId: (item: T) => string;
  favoritesLimit?: number;
  hiddenLimit?: number;
  recentLimit?: number;
  storageVersion?: number;
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

  function load() {
    favorites.value = readStoredList<T>(keys.favorites, favoritesLimit);
    hidden.value = readStoredList<T>(keys.hidden, hiddenLimit);
    recent.value = readStoredList<T>(keys.recent, recentLimit);
  }

  function isFavorite(id: string) {
    return favoriteIds.value.has(id);
  }

  function isHidden(id: string) {
    return hiddenIds.value.has(id);
  }

  function toggleFavorite(item: T) {
    const id = options.getId(item);
    favorites.value = isFavorite(id)
      ? favorites.value.filter((entry) => options.getId(entry) !== id)
      : upsert(favorites.value, item, favoritesLimit);
    if (isHidden(id)) {
      hidden.value = hidden.value.filter((entry) => options.getId(entry) !== id);
      persistHidden();
    }
    persistFavorites();
  }

  function toggleHidden(item: T) {
    const id = options.getId(item);
    hidden.value = isHidden(id)
      ? hidden.value.filter((entry) => options.getId(entry) !== id)
      : upsert(hidden.value, item, hiddenLimit);
    if (isFavorite(id)) {
      favorites.value = favorites.value.filter((entry) => options.getId(entry) !== id);
      persistFavorites();
    }
    persistHidden();
  }

  function addRecent(item: T) {
    recent.value = upsert(recent.value, item, recentLimit);
    latestRecent.value = item;
    persistRecent();
  }

  function removeWhere(predicate: (item: T) => boolean) {
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
    removeWhere,
    load,
  };
}
