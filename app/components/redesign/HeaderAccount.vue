<script setup lang="ts">
// Google sign-in in the site header. Signed out: "Sign in with Google", a
// full-page redirect (no Google script on the site). Signed in: an account
// button with a small menu for signing out and deleting the account data.
// Hidden until the status is known, and entirely when sign-in is not
// configured on the server.
const props = defineProps<{ mobile?: boolean }>();
const emit = defineEmits<{ done: [] }>();

const { t } = useI18n();
const { enabled, signedIn, busy, loaded, init, signIn, signOut, deleteAccount } = useSiteAccount();

const menuOpen = ref(false);
const root = ref<HTMLElement | null>(null);

function onDocumentClick(event: MouseEvent) {
  if (menuOpen.value && root.value && !root.value.contains(event.target as Node)) menuOpen.value = false;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") menuOpen.value = false;
}

async function run(action: () => Promise<boolean>) {
  const done = await action();
  if (done) {
    menuOpen.value = false;
    emit("done");
  }
}

onMounted(() => {
  // The mobile copy shares the state; one copy reports the Google outcome.
  if (!props.mobile) void init();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div v-if="loaded && enabled" ref="root" class="header-account" :class="{ 'header-account_mobile': mobile }">
    <button v-if="!signedIn" type="button" class="header-account__sign-in" @click="signIn">
      <u-icon name="i-lucide-log-in" aria-hidden="true" />
      <span>{{ t("flats.accountSignIn") }}</span>
    </button>

    <template v-else>
      <button
          type="button"
          class="header-account__toggle"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          :aria-label="t('account.menu')"
          :title="t('account.menu')"
          @click="menuOpen = !menuOpen"
      >
        <u-icon name="i-lucide-circle-user-round" aria-hidden="true" />
        <span v-if="mobile">{{ t("account.signedIn") }}</span>
      </button>
      <div v-show="menuOpen" class="header-account__menu" role="menu">
        <p class="header-account__note">{{ t("account.signedIn") }}</p>
        <button type="button" role="menuitem" class="header-account__item" :disabled="busy" @click="run(signOut)">
          <u-icon name="i-lucide-log-out" aria-hidden="true" />{{ t("flats.accountSignOut") }}
        </button>
        <button type="button" role="menuitem" class="header-account__item header-account__item_danger" :disabled="busy" @click="run(deleteAccount)">
          <u-icon name="i-lucide-trash-2" aria-hidden="true" />{{ t("flats.accountDelete") }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.header-account {
  position: relative;
}
.header-account__sign-in,
.header-account__toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line);
  background: none;
  color: var(--text-primary);
  font-size: 13.5px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
}
.header-account__sign-in {
  padding: 8px 14px;
}
.header-account__toggle {
  padding: 7px;
}
.header-account__sign-in:hover,
.header-account__toggle:hover,
.header-account__toggle[aria-expanded="true"] {
  border-color: var(--accent-pink);
}
.header-account__sign-in :deep(svg),
.header-account__toggle :deep(svg) {
  width: 18px;
  height: 18px;
}
.header-account__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  min-width: 230px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
}
.header-account__note {
  margin: 2px 8px 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.header-account__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-primary);
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
}
.header-account__item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
}
.header-account__item:disabled {
  opacity: 0.6;
  cursor: default;
}
.header-account__item_danger {
  color: #f29ab6;
}
.header-account__item :deep(svg) {
  width: 16px;
  height: 16px;
}
.header-account_mobile .header-account__menu {
  left: 0;
  right: auto;
}
</style>
