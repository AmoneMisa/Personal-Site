<script setup lang="ts">
import RedesignEmoji from "~/components/redesign/RedesignEmoji.vue";
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const nav = computed(() => content.value.nav);

const localePath = useLocalePath();
// Anchors resolve against the home page so header links work from any route
// (e.g. clicking "Опыт" on /services navigates home and scrolls to #experience).
function resolveHref(href: string) {
  if (!href) return href;
  if (href.startsWith("#")) return `${localePath("/")}${href}`;
  if (href.startsWith("/")) return localePath(href);
  return href;
}

// ---- Locale toggle (static i18n: setLocale swaps messages + persists cookie) ----
const { locale, locales, setLocale } = useI18n();
async function toggleLocale() {
  const codes = (locales.value ?? []).map((l: any) => (typeof l === "string" ? l : l.code));
  const next = codes.find((c: string) => c !== locale.value) ?? locale.value;
  if (next !== locale.value) await setLocale(next);
}

const mobileOpen = ref(false);
</script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-header__logo" :href="resolveHref('/')" @click="mobileOpen = false">
        <redesign-emoji cp="1f988" :size="20" alt="акула" />
        WhitesLove
      </a>

      <nav class="site-header__nav">
        <a class="site-header__link" :href="resolveHref('#profile-skills')">{{ nav.skills }}</a>
        <a class="site-header__link" :href="resolveHref('#experience')">{{ nav.experience }}</a>

        <div class="site-header__dropdown-wrap">
          <a class="site-header__link" :href="resolveHref('#pet-projects')" tabindex="0">{{ nav.petProjects }} ▾</a>
          <div class="site-header__dropdown">
            <div class="site-header__dropdown-column">
              <h6 class="mono">{{ nav.dropdown.petTitle }}</h6>
              <a v-for="it in nav.dropdown.pet" :key="it.label" :href="resolveHref(it.href)">
                {{ it.label }}<span>{{ it.sub }}</span>
              </a>
            </div>
            <div class="site-header__dropdown-column">
              <h6 class="mono">{{ nav.dropdown.pagesTitle }}</h6>
              <a v-for="it in nav.dropdown.pages" :key="it.label" :href="resolveHref(it.href)">
                {{ it.label }}<span>{{ it.sub }}</span>
              </a>
            </div>
          </div>
        </div>

        <a class="site-header__link" :href="resolveHref('#tools')">{{ nav.tools }}</a>
        <a class="site-header__link" :href="resolveHref('/cv')">{{ nav.cv }}</a>
        <a class="site-header__link site-header__link_highlight" :href="resolveHref('/about')">{{ nav.aboutMe }}</a>
      </nav>

      <div class="site-header__actions">
        <button type="button" class="site-header__language mono" @click="toggleLocale" :aria-label="`Switch language (${locale})`">
          {{ String(locale).toUpperCase() }}
        </button>
        <a class="site-header__cta" :href="resolveHref('#contact')">{{ nav.contact }}</a>
      </div>

      <button
          type="button"
          class="site-header__burger"
          :class="{ 'site-header__burger_open': mobileOpen }"
          :aria-expanded="mobileOpen"
          aria-label="Меню"
          @click="mobileOpen = !mobileOpen"
      >
        <span class="site-header__bar" /><span class="site-header__bar" /><span class="site-header__bar" />
      </button>
    </div>

    <div v-show="mobileOpen" class="site-header__mobile-panel">
      <a class="site-header__mobile-link" :href="resolveHref('#profile-skills')" @click="mobileOpen = false">{{ nav.skills }}</a>
      <a class="site-header__mobile-link" :href="resolveHref('#experience')" @click="mobileOpen = false">{{ nav.experience }}</a>
      <a class="site-header__mobile-link" :href="resolveHref('#pet-projects')" @click="mobileOpen = false">{{ nav.petProjects }}</a>
      <a class="site-header__mobile-link" :href="resolveHref('#tools')" @click="mobileOpen = false">{{ nav.tools }}</a>
      <a class="site-header__mobile-link" :href="resolveHref('/cv')" @click="mobileOpen = false">{{ nav.cv }}</a>
      <a class="site-header__mobile-link site-header__mobile-link_highlight" :href="resolveHref('/about')" @click="mobileOpen = false">{{ nav.aboutMe }}</a>
      <div class="site-header__mobile-actions">
        <button type="button" class="site-header__language mono" @click="toggleLocale">{{ String(locale).toUpperCase() }}</button>
        <a class="site-header__cta" :href="resolveHref('#contact')" @click="mobileOpen = false">{{ nav.contact }}</a>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(13, 17, 40, 0.94);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}
.site-header__inner {
  max-width: 1140px;
  margin: 0 auto;
  padding: 16px 32px;
  display: flex;
  align-items: center;
  gap: 32px;
}
.site-header__logo {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: "Golos Text", sans-serif;
  font-weight: 400;
  font-size: 17px;
  color: var(--text-primary);
  white-space: nowrap;
}
.site-header__nav {
  display: flex;
  align-items: center;
  gap: 26px;
  flex: 1;
}
.site-header__link {
  font-size: 14px;
  color: var(--text-muted);
  transition: color 0.15s;
  white-space: nowrap;
  padding: 8px 0;
  cursor: pointer;
}
.site-header__link:hover,
.site-header__link:focus-visible {
  color: var(--text-primary);
}
.site-header__link_highlight {
  color: var(--accent-pink);
  border-bottom: 1px solid currentColor;
  padding-bottom: 6px;
}
.site-header__actions {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-left: auto;
}
.site-header__language {
  font-size: 13px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}
.site-header__language:hover {
  color: var(--text-primary);
}
.site-header__cta {
  border: 1px solid var(--line);
  color: var(--text-primary);
  font-size: 13.5px;
  padding: 8px 16px;
  border-radius: 6px;
  white-space: nowrap;
  transition: border-color 0.15s;
}
.site-header__cta:hover {
  border-color: var(--accent-pink);
}

/* dropdown */
.site-header__dropdown-wrap {
  position: relative;
}
.site-header__dropdown {
  position: absolute;
  top: 100%;
  left: -16px;
  margin-top: 4px;
  background: var(--bg-panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  width: 420px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  transition: opacity 0.15s, transform 0.15s, visibility 0.15s;
}
.site-header__dropdown-wrap:hover .site-header__dropdown,
.site-header__dropdown-wrap:focus-within .site-header__dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.site-header__dropdown-column h6 {
  font-size: 10.5px;
  color: var(--text-muted);
  font-weight: 400;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.site-header__dropdown-column a {
  display: block;
  font-size: 13.5px;
  color: var(--text-primary);
  padding: 6px 0;
  opacity: 0.85;
}
.site-header__dropdown-column a:hover {
  opacity: 1;
  color: var(--accent-pink);
}
.site-header__dropdown-column a span {
  display: block;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 1px;
}

/* burger + mobile */
.site-header__burger {
  display: none;
  flex-direction: column;
  gap: 4px;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: auto;
}
.site-header__bar {
  width: 15px;
  height: 1.5px;
  background: var(--text-muted);
  transition: all 0.2s;
}
.site-header__burger_open .site-header__bar:nth-child(1) {
  transform: translateY(5.5px) rotate(45deg);
}
.site-header__burger_open .site-header__bar:nth-child(2) {
  opacity: 0;
}
.site-header__burger_open .site-header__bar:nth-child(3) {
  transform: translateY(-5.5px) rotate(-45deg);
}
.site-header__mobile-panel {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 12px 32px 20px;
  border-top: 1px solid var(--line);
  background: rgba(13, 17, 40, 0.98);
}
.site-header__mobile-link {
  padding: 10px 0;
  color: var(--text-muted);
  font-size: 15px;
}
.site-header__mobile-link_highlight {
  color: var(--accent-pink);
}
.site-header__mobile-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
}

@media (max-width: 960px) {
  .site-header__nav,
  .site-header__actions {
    display: none;
  }
  .site-header__burger {
    display: flex;
  }
  .site-header__mobile-panel {
    display: flex;
  }
}
</style>
