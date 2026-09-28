<script setup lang="ts">
// "Sign in with Google" on the Favourites tab. Signing in links this browser's
// saved flats to a Google account, shared with the Flat Finder app and other
// browsers (server/flats/googleOAuth.ts, apps/flats mobile-account.js).
//
// Signing in is a full-page redirect to Google and back, so no Google script
// runs here. Signing out or deleting leaves this browser empty: the saved
// flats belong to the account, not to whoever uses this browser next -- the
// page clears its local copy when useSiteAccount's `signedOutAt` changes.
// Shares its state with the header's account button, which also reports how
// the trip to Google went.
const { t } = useI18n();
const { enabled, signedIn, busy, signIn, signOut, deleteAccount } = useSiteAccount();
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
