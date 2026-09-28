// Jobs and CV lists under the site's Google account: favourites, hidden,
// recently viewed, seen marks and search presets. The account API is
// /account-lists (server/routes/account-lists.*), backed by
// whiteslove.me-backend-platform apps/flats/src/mobile/mobile-lists.js.
//
// Only a signed-in browser syncs; signed out, everything stays local as before.
//
//  - First sync of a list in this browser: a union merge. The browser's items
//    are added to the account (`add` never overwrites), and the account's are
//    added here.
//  - Every later page load: the account is the truth and replaces the local
//    copy, so a removal on another device does not come back from this one.
//  - Signing out: the list is emptied here; its items stay with the account.
//
// Sync is an enhancement: any failure switches it off for the page and the
// page carries on with its local copy.
import { safeFetch } from "~/utils/safeFetch";
import { readStoredValue, writeStoredValue } from "~/utils/browserStorage";

export type AccountListDomain = "jobs" | "cv";
export type AccountListName = "favorites" | "hidden" | "recent" | "seen" | "presets";
export interface AccountListItem { key: string; payload: unknown }
export type AccountListOp =
  | { op: "put" | "add"; list: AccountListName; key: string; payload?: unknown }
  | { op: "delete"; list: AccountListName; key: string }
  | { op: "clear"; list: AccountListName };

type RemoteLists = Partial<Record<AccountListName, AccountListItem[]>>;

const MAX_OPS = 200;
// The backend rejects a batch holding any payload over 64 KB; such an item
// stays local rather than taking the rest of the batch down with it.
const MAX_PAYLOAD_BYTES = 60 * 1024;
const FLUSH_DELAY_MS = 400;
const PULL_REUSE_MS = 5_000;

// Per page (client only): one read shared by every list of a domain, and one
// write queue, so a page with several synced lists does not trip the
// backend's per-client rate limit.
interface DomainChannel {
  pull: { at: number; promise: Promise<RemoteLists | null> } | null;
  pending: AccountListOp[];
  timer: ReturnType<typeof setTimeout> | null;
  flushing: Promise<void> | null;
  live: boolean;
}
const channels = new Map<AccountListDomain, DomainChannel>();

function channelFor(domain: AccountListDomain): DomainChannel {
  let channel = channels.get(domain);
  if (!channel) {
    channel = { pull: null, pending: [], timer: null, flushing: null, live: true };
    channels.set(domain, channel);
  }
  return channel;
}

/**
 * Local copies of account data, cleared on sign-out wherever it happens (the
 * header works on every page, so the jobs or hiring page may not be open).
 * Flats favourites are included: after signing out they belong to the account
 * too (see FlatAccountBar).
 */
export const ACCOUNT_LOCAL_KEYS = [
  "flats:favorites:v1",
  "jobs:favorites:v1", "jobs:hidden:v1", "jobs:recent:v1", "jobs:seen:v1",
  "hiring:favorites:v1", "hiring:hidden:v1", "hiring:recent:v1", "hiring:presets:v1",
];
const MERGED_MARKER_PREFIX = "account:merged:";

export function clearAccountLocalCopies() {
  try {
    for (const key of ACCOUNT_LOCAL_KEYS) localStorage.removeItem(key);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(MERGED_MARKER_PREFIX)) localStorage.removeItem(key);
    }
  } catch { /* storage disabled */ }
}

const mergedMarker = (domain: AccountListDomain, list: AccountListName) => `${MERGED_MARKER_PREFIX}${domain}:${list}:v1`;

/**
 * Local and remote combined: local order first, then what only the account
 * has. Returns the keys only this browser had, which the caller adds upstream.
 */
export function unionByKey<T>(local: T[], remote: T[], keyOf: (item: T) => string, limit: number) {
  const localKeys = new Set(local.map(keyOf));
  const remoteKeys = new Set(remote.map(keyOf));
  const merged = [...local, ...remote.filter((item) => !localKeys.has(keyOf(item)))].slice(0, limit);
  const localOnly = local.filter((item) => !remoteKeys.has(keyOf(item)));
  return { merged, localOnly };
}

export function useAccountLists(domain: AccountListDomain) {
  const { loaded, signedIn, signedOutAt } = useSiteAccount();
  const channel = channelFor(domain);
  const url = `/account-lists?domain=${domain}`;

  async function flush(): Promise<void> {
    if (channel.flushing) return channel.flushing;
    channel.flushing = (async () => {
      while (channel.live && channel.pending.length) {
        const ops = channel.pending.splice(0, MAX_OPS);
        const { error } = await safeFetch(url, { method: "POST", body: { ops } });
        if (error) channel.live = false;
      }
      channel.pending = [];
    })().finally(() => { channel.flushing = null; });
    return channel.flushing;
  }

  function fits(op: AccountListOp) {
    if (op.op !== "put" && op.op !== "add") return true;
    try {
      return new Blob([JSON.stringify(op.payload ?? {})]).size <= MAX_PAYLOAD_BYTES;
    } catch {
      return false;
    }
  }

  function queue(...ops: AccountListOp[]) {
    if (!import.meta.client || !signedIn.value || !channel.live) return;
    const accepted = ops.filter(fits);
    if (!accepted.length) return;
    channel.pending.push(...accepted);
    if (channel.timer) clearTimeout(channel.timer);
    channel.timer = setTimeout(() => {
      channel.timer = null;
      void flush();
    }, FLUSH_DELAY_MS);
  }

  function pull(): Promise<RemoteLists | null> {
    const now = Date.now();
    if (channel.pull && now - channel.pull.at < PULL_REUSE_MS) return channel.pull.promise;
    const promise = safeFetch<{ ok: boolean; lists: RemoteLists | null }>(url).then(({ data, error }) => {
      if (error || !data?.ok || !data.lists) {
        channel.live = false;
        return null;
      }
      return data.lists;
    });
    channel.pull = { at: now, promise };
    return promise;
  }

  /**
   * Keeps one local list in step with the account. `read` and `write` get and
   * replace the local copy (newest first, or oldest first with `oldestFirst`);
   * `keyOf`/`toPayload`/`fromPayload` map items to the account's rows, which
   * come back newest first.
   */
  function syncList<T>(list: AccountListName, config: {
    read: () => T[];
    write: (items: T[]) => void;
    keyOf: (item: T) => string;
    toPayload: (item: T) => unknown;
    fromPayload: (item: AccountListItem) => T | null;
    limit: number;
    oldestFirst?: boolean;
  }) {
    if (!import.meta.client) return;
    let started = false;

    async function start() {
      if (started) return;
      started = true;
      const lists = await pull();
      if (!lists || !signedIn.value) return;
      const newestFirst = (lists[list] ?? [])
        .map(config.fromPayload)
        .filter((item): item is T => item != null)
        .slice(0, config.limit);
      const remote = config.oldestFirst ? [...newestFirst].reverse() : newestFirst;
      const marker = mergedMarker(domain, list);
      if (readStoredValue<boolean>(marker)) {
        config.write(remote);
        return;
      }
      const { merged, localOnly } = unionByKey(config.read(), remote, config.keyOf, config.limit);
      config.write(merged);
      // Oldest first, so the newest local item ends up newest in the account.
      const oldestLocalFirst = config.oldestFirst ? localOnly : [...localOnly].reverse();
      queue(...oldestLocalFirst.map((item) => ({
        op: "add" as const, list, key: config.keyOf(item), payload: config.toPayload(item),
      })));
      writeStoredValue(marker, true);
    }

    watch([loaded, signedIn], ([isLoaded, isSignedIn]) => {
      if (isLoaded && isSignedIn) void start();
    }, { immediate: true });

    watch(signedOutAt, () => {
      started = false;
      channel.pull = null;
      channel.pending = [];
      channel.live = true;
      // Storage is already cleared (clearAccountLocalCopies); empty the page.
      config.write([]);
    });
  }

  const put = (list: AccountListName, key: string, payload: unknown = {}) => queue({ op: "put", list, key, payload });
  const remove = (list: AccountListName, key: string) => queue({ op: "delete", list, key });

  // Do not lose the last few changes when the visitor leaves right away.
  function flushOnLeave() {
    if (!channel.live || !channel.pending.length) return;
    const ops = channel.pending.splice(0, MAX_OPS);
    try {
      void fetch(url, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) });
    } catch { /* best effort */ }
  }
  onMounted(() => window.addEventListener("pagehide", flushOnLeave));
  onBeforeUnmount(() => {
    window.removeEventListener("pagehide", flushOnLeave);
    // Leaving the page inside the app: send what is queued now.
    if (channel.pending.length) void flush();
  });

  return { syncList, queue, put, remove, flush };
}
