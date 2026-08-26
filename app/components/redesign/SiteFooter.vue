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
    { label: "Telegram", href: CONTACTS.telegram, icon: "i-lucide-send" },
    { label: "WhatsApp", href: CONTACTS.whatsapp, icon: "i-lucide-message-circle" },
    { label: "LinkedIn", href: CONTACTS.linkedin, icon: "i-lucide-linkedin" },
    { label: "GitHub", href: CONTACTS.github, icon: "i-lucide-github" },
    {
      label: "Email",
      href: CONTACTS.email ? `mailto:${CONTACTS.email}` : "",
      icon: "i-lucide-mail",
    },
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

        <div class="site-footer__content">
          <nav class="site-footer__nav" :aria-label="f.navTitle">
            <h6 class="site-footer__column-title mono">{{ f.navTitle }}</h6>
            <div class="site-footer__nav-grid">
              <a
                v-for="l in f.navLinks"
                :key="l.label"
                class="site-footer__link"
                :href="resolveHref(l.href)"
              >{{ l.label }}</a>
            </div>
          </nav>

          <div class="site-footer__contacts">
            <h6 class="site-footer__column-title mono">{{ f.contactsTitle }}</h6>
            <div class="site-footer__contacts-row">
              <a
                v-for="c in contactLinks"
                :key="c.label"
                class="site-footer__contact-link"
                :href="c.href"
                :target="isExternal(c.href) ? '_blank' : undefined"
                :rel="isExternal(c.href) ? 'noopener noreferrer' : undefined"
              >
                <u-icon :name="c.icon" class="site-footer__contact-icon" aria-hidden="true" />
                <span>{{ c.label }}</span>
              </a>
            </div>
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
  --section-title-gap: 12px;
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--line);
  padding: 44px 0 32px;
  margin-top: 16px;
  background: #070c22;
  box-shadow: 0 -18px 48px rgba(4, 8, 28, 0.36);
}

.site-footer__grid {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 1fr);
  gap: 40px;
  align-items: start;
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

.site-footer__content {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.site-footer__nav,
.site-footer__contacts {
  min-width: 0;
}

.site-footer__nav-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 36px;
  row-gap: 9px;
}

.site-footer__column-title {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 var(--section-title-gap);
  font-weight: 400;
}

.site-footer__link,
.site-footer__contact-link {
  font-size: 13.5px;
  color: var(--text-muted);
}

.site-footer__link {
  display: block;
}

.site-footer__link:hover,
.site-footer__contact-link:hover {
  color: var(--text-primary);
}

.site-footer__contacts-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.site-footer__contact-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  min-width: 0;
  white-space: nowrap;
}

.site-footer__contact-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: currentColor;
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

@media (max-width: 980px) {
  .site-footer__grid {
    grid-template-columns: 1fr;
  }

  .site-footer__nav-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-footer__contacts-row {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 700px) {
  .site-footer__contacts-row {
    gap: 12px 20px;
  }
}
</style>
