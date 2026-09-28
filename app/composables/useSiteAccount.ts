// The site's Google account: one account for flats, jobs and CVs
// (whiteslove.me-backend-platform, apps/flats mobile-account.js and
// mobile-lists.js); the sign-in flow is server/flats/googleOAuth.ts.
//
// State is shared (useState) so the header button and the Favourites bar show
// the same thing. Signing out clears this browser's copies of account data
// (clearAccountLocalCopies), and open pages watch `signedOutAt` to empty what
// they show: the data belongs to the account, not to whoever uses this
// browser next. Jobs and CV lists sync through useAccountLists.
import { safeFetch } from "~/utils/safeFetch";
import { clearAccountLocalCopies } from "~/composables/useAccountLists";

const OUTCOMES: Record<string, { key: string; color: "success" | "neutral" | "error" }> = {
  linked: { key: "flats.accountLinked", color: "success" },
  cancelled: { key: "flats.accountCancelled", color: "neutral" },
  failed: { key: "flats.accountFailed", color: "error" },
  unavailable: { key: "flats.accountFailed", color: "error" },
};

export function useSiteAccount() {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();

  const enabled = useState("site-account:enabled", () => false);
  const signedIn = useState("site-account:signed-in", () => false);
  const busy = useState("site-account:busy", () => false);
  const loaded = useState("site-account:loaded", () => false);
  const signedOutAt = useState("site-account:signed-out-at", () => 0);

  async function refresh() {
    const { data } = await safeFetch<{ enabled: boolean; signedIn: boolean }>("/flats-account");
    enabled.value = data?.enabled === true;
    signedIn.value = data?.signedIn === true;
    loaded.value = true;
  }

  /** Once per page load: fetch the status and report how the trip to Google went. */
  async function init() {
    // Drop the marker so a reload or a shared link does not repeat the toast.
    const outcome = OUTCOMES[String(route.query.account ?? "")];
    if (outcome) {
      toast.add({ title: t(outcome.key), color: outcome.color });
      const { account: _shown, ...query } = route.query;
      void router.replace({ path: route.path, query });
    }
    if (!loaded.value || outcome) await refresh();
  }

  function signIn() {
    // Back to exactly this page, without a stale outcome from a previous try.
    const { account: _previous, ...query } = route.query;
    const back = router.resolve({ path: route.path, query }).fullPath;
    window.location.assign(`/flats-account-google-start?return=${encodeURIComponent(back)}`);
  }

  async function leave(path: "/flats-account-sign-out" | "/flats-account-delete", doneKey: string) {
    busy.value = true;
    const { data } = await safeFetch<{ ok: boolean }>(path, { method: "POST" });
    busy.value = false;
    if (!data?.ok) {
      toast.add({ title: t("flats.accountActionFailed"), color: "error" });
      return false;
    }
    signedIn.value = false;
    clearAccountLocalCopies();
    signedOutAt.value = Date.now();
    toast.add({ title: t(doneKey), color: "neutral" });
    return true;
  }

  const signOut = () => leave("/flats-account-sign-out", "flats.accountSignedOutToast");
  async function deleteAccount() {
    if (!window.confirm(t("flats.accountDeleteConfirm"))) return false;
    return leave("/flats-account-delete", "flats.accountDeleted");
  }

  return { enabled, signedIn, busy, loaded, signedOutAt, init, refresh, signIn, signOut, deleteAccount };
}
