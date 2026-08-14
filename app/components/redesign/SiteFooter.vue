<script setup lang="ts">
import RedesignEmoji from "~/components/redesign/RedesignEmoji.vue";
import { useHomeContent, CONTACTS } from "~/composables/useHomeContent";

const content = useHomeContent();
const f = computed(() => content.value.footer);

const localePath = useLocalePath();
function resolveHref(href: string) {
  if (!href) return href;
  if (href.startsWith("#")) return `${localePath("/")}${href}`;
  if (href.startsWith("/")) return localePath(href);
  return href;
}

const contactLinks = computed(() =>
  [
    { label: "Telegram", href: CONTACTS.telegram },
    { label: "WhatsApp", href: CONTACTS.whatsapp },
    { label: "LinkedIn", href: CONTACTS.linkedin },
    { label: "GitHub", href: CONTACTS.github },
    { label: "Email", href: CONTACTS.email ? `mailto:${CONTACTS.email}` : "" },
  ].filter((c) => c.href)
);
function isExternal(href: string) {
  return href.startsWith("http");
}
</script>

<template>
  <footer id="contact" class="site-footer">
    <div class="rd-wrap">
      <div class="site-footer__grid">
        <div class="site-footer__brand">
          <a class="site-footer__logo" :href="resolveHref('/')">
            <redesign-emoji cp="1f988" :size="20" alt="акула" />
            WhitesLove
          </a>
          <p class="site-footer__tagline">{{ f.tag }}</p>
        </div>
        <div class="site-footer__links">
          <div class="site-footer__column">
            <h6 class="site-footer__column-title mono">{{ f.navTitle }}</h6>
            <a v-for="l in f.navLinks" :key="l.label" class="site-footer__link" :href="resolveHref(l.href)">{{ l.label }}</a>
          </div>
          <div class="site-footer__column">
            <h6 class="site-footer__column-title mono">{{ f.contactsTitle }}</h6>
            <a
                v-for="c in contactLinks"
                :key="c.label"
                class="site-footer__link"
                :href="c.href"
                :target="isExternal(c.href) ? '_blank' : undefined"
                :rel="isExternal(c.href) ? 'noopener noreferrer' : undefined"
            >{{ c.label }}</a>
          </div>
        </div>
      </div>
      <div class="site-footer__bottom mono">
        <span>{{ f.copyright }}</span>
        <span class="site-footer__motto">
          <redesign-emoji cp="1f988" :size="15" alt="акула" />
          {{ f.motto }}
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.site-footer {
  border-top: 1px solid var(--line);
  padding: 44px 0 32px;
  margin-top: 16px;
}
.site-footer__grid {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  flex-wrap: wrap;
}
.site-footer__logo {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: "Golos Text", sans-serif;
  font-size: 17px;
  color: var(--text-primary);
}
.site-footer__tagline {
  color: var(--text-muted);
  font-size: 13px;
  max-width: 290px;
  margin-top: 14px;
  line-height: 1.6;
}
.site-footer__links {
  display: flex;
  gap: 36px;
  flex-wrap: wrap;
}
.site-footer__column-title {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 12px;
  font-weight: 400;
}
.site-footer__link {
  display: block;
  font-size: 13.5px;
  color: var(--text-muted);
  margin-bottom: 9px;
}
.site-footer__link:hover {
  color: var(--text-primary);
}
.site-footer__bottom {
  margin-top: 32px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 12px;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.site-footer__motto {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
