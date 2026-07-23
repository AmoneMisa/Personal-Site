<script setup lang="ts">
import {en, ru, kk} from '@nuxt/ui/locale';
import HeaderMenu from "~/components/HeaderMenu.vue";
import {reloadLocaleData} from "~/composables/useLocaleReload";

const header = useTemplateRef('header');
const isSticky = ref(false);
const isVisible = ref(false);

type Lang = { code: string; name?: string };

const {locale, setLocaleCookie, setLocale, t} = useI18n();

const config = useRuntimeConfig();
const api = config.public.apiBase;

const {data: langs, pending: langsPending} = await useFetch<Lang[]>(
    '/languages/enabled',
    {baseURL: api}
);
const uiLocaleMap: Record<string, any> = {en, ru, kk};
const localesForSelect = computed(() =>
    (langs.value ?? [])
        .map((l) => uiLocaleMap[l.code])
        .filter(Boolean)
);

const safeLocalesForSelect = computed(() =>
    localesForSelect.value.length ? localesForSelect.value : [en, ru, kk]
);

async function onLocaleChange(v: any) {
  const code = typeof v === 'string' ? v : v?.code;
  if (!code) return;
  if (code === locale.value) return;
  setLocaleCookie(code);
  await reloadLocaleData(nuxtApp, code);
  await setLocale(code);
}

onMounted(() => {
  const el = header.value?.$el;
  if (!el) return;

  const sentinel = document.createElement('div');
  el.before(sentinel);

  const observer = new IntersectionObserver(([entry]) => {
    const sticky = !entry.isIntersecting;
    isSticky.value = sticky;

    if (sticky) {
      isVisible.value = false;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isVisible.value = true;
        });
      });
    } else {
      isVisible.value = false;
    }
  });

  observer.observe(sentinel);
});

const nuxtApp = useNuxtApp();
const colorMode = useColorMode();

function toggleTheme() {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark';
}

const isMenuOpen = ref(false);
const isPageLoaded = ref(false);

onMounted(() => {
  const markLoaded = () => { isPageLoaded.value = true }

  if (document.readyState === 'complete') {
    markLoaded();
  } else {
    window.addEventListener('load', markLoaded, { once: true });
  }
});
</script>

<template>
  <u-header
      ref="header"
      v-model:open="isMenuOpen"
      mode="drawer"
      :menu="{
    direction: 'right',
    inset: true
  }"
      class="header bg-transparent border-0"
      :class="{ header_sticky: isSticky, header_visible: isVisible }"
      :ui="{
    overlay: 'bg-black/60 backdrop-blur-sm',
    content: 'w-[86vw] max-w-[360px] bg-[rgba(14,12,21,0.98)] border-l border-white/10'
  }"
  >
    <template #left>
      <a class="header__logo" href="/">
        <nuxt-img
            class="header__logo-image"
            src="/images/logo.png"
            alt="Logo"
            format="png"
            quality="100"
            width="159"
            height="35"
            fit="contain"
            sizes="159px"
            :widths="[159, 318]"
        />
      </a>
    </template>
    <template #default>
      <div class="hidden xl:block">
        <header-menu variant="desktop"/>
      </div>
    </template>
    <template #right>
      <div class="hidden xl:flex items-center gap-2 xl:gap-3">
        <div class="ui-pill-btn" :class="{ 'ui-pill-btn_animated': isPageLoaded }">
          <u-locale-select
              class="ui-pill-btn__inner ui-locale"
              :model-value="locale"
              @update:model-value="onLocaleChange"
              :locales="safeLocalesForSelect"
              :disabled="langsPending && !langs"
              :ui="{
                item: 'text-white/70',
              base: 'h-10 min-w-[120px] xl:min-w-[150px] px-3 text-sm font-medium dark:text-white/90 text-[var(--ui-text)]/90 flex items-center justify-between gap-2',
              value: 'truncate text-left max-w-[80px] sm:max-w-[100px] xl:max-w-[120px]',
              trailing: 'shrink-0 text-white/70 translate-y-[1px]',
              content: 'mt-2 w-[220px] rounded-xl bg-[rgba(14,12,21,0.96)] backdrop-blur-xl border border-white/10 shadow-2xl p-2'
            }"
          />
        </div>
        <div class="ui-pill-btn" :class="{ 'ui-pill-btn_animated': isPageLoaded }">
          <button
              type="button"
              class="ui-pill-btn__inner text-sm font-semibold dark:text-white/90 text-[var(--ui-text)]/90 dark:hover:text-white hover:text-[var(--ui-text)] whitespace-nowrap"
              @click="toggleTheme"
          >
            {{t('header.button.changeTheme')}}
          </button>
        </div>
        <div class="ui-pill-btn" :class="{ 'ui-pill-btn_animated': isPageLoaded }">
          <u-link
              href="https://amonemisa.github.io/personal/"
              no-rel
              target="_blank"
              class="ui-pill-btn__inner text-sm font-semibold dark:text-white/90 text-[var(--ui-text)]/90 dark:hover:text-white hover:text-[var(--ui-text)] whitespace-nowrap"
          >
            {{ t('button.getStart') }}
          </u-link>
        </div>
      </div>
    </template>
    <template #content="{ close }">
      <div class="h-[100dvh] overflow-y-auto p-4 flex flex-col gap-4">
        <header-menu variant="mobile" @navigate="close?.()"/>
        <div class="h-px bg-white/10 my-1"/>
        <div class="flex flex-col gap-3">
          <u-locale-select
              class="ui-locale-mobile"
              :model-value="locale"
              @update:model-value="(v) => { onLocaleChange(v); close?.() }"
              :locales="safeLocalesForSelect"
              :disabled="langsPending && !langs"
              :ui="{
          base: 'h-11 w-full px-3 text-sm font-medium dark:text-white/90 text-[var(--ui-text)]/90 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5',
          value: 'truncate text-left',
          trailing: 'shrink-0 dark:text-white/70 text-[var(--ui-text)]/70 translate-y-[1px]',
          content: 'mt-2 w-[240px] rounded-xl bg-[rgba(14,12,21,0.96)] backdrop-blur-xl border border-white/10 shadow-2xl p-2'
        }"
          />

          <button
              type="button"
              class="h-11 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-semibold dark:text-white/90 text-[var(--ui-text)]/90 dark:hover:text-white hover:text-[var(--ui-text)]"
              @click="toggleTheme(); close?.()"
          >
            {{ t('header.button.changeTheme') }}
          </button>

          <u-link
              href="https://amonemisa.github.io/personal/"
              no-rel
              target="_blank"
              class="h-11 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-semibold dark:text-white/90 text-[var(--ui-text)]/90 dark:hover:text-white hover:text-[var(--ui-text)] flex items-center justify-center"
              @click="close?.()"
          >
            {{ t('button.getStart') }}
          </u-link>
        </div>
      </div>
    </template>
  </u-header>
</template>

<style lang="scss">
.header {
  transition: background-color .3s ease;

  &.header_sticky {
    animation-name: hideShowHeader;
    animation-duration: 1s;
    animation-timing-function: ease;
    animation-fill-mode: forwards;
    background-color: var(--color-blackest);
  }
}

@keyframes hideShowHeader {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(0);
  }
}

.header__logo {
  max-height: 35px;
  min-width: 120px;

  @media (min-width: 640px) {
    min-width: 160px;
  }
}

.header__logo-image {
  filter: drop-shadow(0px 0px 12px var(--color-primary));
}

.light {
  .header__logo-image {
    filter: drop-shadow(1px 1px 2px #5121f5);
  }
}
</style>