<script setup lang="ts">
// "Sign in with Google" on the Favourites tab. Signing in links this browser's
// saved flats to a Google account, shared with the Flat Finder app and other
// browsers (server/flats/googleOAuth.ts, apps/flats mobile-account.js).
//
// Signing in is a full-page redirect to Google and back, so no Google script
// runs here. Signing out or deleting leaves this browser empty: the saved
// flats belong to the account, not to whoever uses this browser next -- the
// page clears its local copy when `signed-out` fires.
import { safeFetch } from "~/utils/safeFetch";

const emit = defineEmits<{ "signed-out": [] }>();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const enabled = ref(false);
const signedIn = ref(false);
const busy = ref(false);

const OUTCOMES: Record<string, { key: string; color: "success" | "neutral" | "error" }> = {
  linked: { key: "flats.accountLinked", color: "success" },
  cancelled: { key: "flats.accountCancelled", color: "neutral" },
  failed: { key: "flats.accountFailed", color: "error" },
  unavailable: { key: "flats.accountFailed", color: "error" },
};

async function refresh() {
  const { data } = await safeFetch<{ enabled: boolean; signedIn: boolean }>("/flats-account");
  enabled.value = data?.enabled === true;
  signedIn.value = data?.signedIn === true;
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
    return;
  }
  signedIn.value = false;
  emit("signed-out");
  toast.add({ title: t(doneKey), color: "neutral" });
}

const signOut = () => leave("/flats-account-sign-out", "flats.accountSignedOutToast");
function deleteAccount() {
  if (!window.confirm(t("flats.accountDeleteConfirm"))) return;
  void leave("/flats-account-delete", "flats.accountDeleted");
}

onMounted(async () => {
  // Report how the round trip to Google went, then drop the marker so a
  // reload or a shared link does not repeat it.
  const outcome = OUTCOMES[String(route.query.account ?? "")];
  if (outcome) {
    toast.add({ title: t(outcome.key), color: outcome.color });
    const { account: _shown, ...query } = route.query;
    void router.replace({ path: route.path, query });
  }
  await refresh();
});
</script>

<template>
  <section v-if="enabled" class="flat-account" :aria-busy="busy">
    <p class="flat-account__text">
      {{ signedIn ? t("flats.accountSignedIn") : t("flats.accountSignedOut") }}
      <span class="flat-account__note text-muted">{{ t("flats.accountPrivacy") }}</span>
    </p>
    <div class="flat-account__actions">
      <u-button v-if="!signedIn" type="button" color="primary" @click="signIn">{{ t("flats.accountSignIn") }}</u-button>
      <template v-else>
        <u-button type="button" color="neutral" variant="outline" :loading="busy" :disabled="busy" @click="signOut">{{ t("flats.accountSignOut") }}</u-button>
        <u-button type="button" color="error" variant="ghost" :disabled="busy" @click="deleteAccount">{{ t("flats.accountDelete") }}</u-button>
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.flat-account {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin: 4px 0 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-panel-2);
}
.flat-account__text { margin: 0; flex: 1 1 320px; }
.flat-account__note { display: block; font-size: 0.85em; margin-top: 2px; }
.flat-account__actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
