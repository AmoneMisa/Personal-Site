<script setup lang="ts">
import ContactItem from "~/components/footer/ContactItem.vue";

const footerMenus = useFooterBlocks();
const contactsData = useContacts();
const contacts = computed(() => contactsData?.value?.contacts ?? []);

const {t} = useI18n();
const localePath = useLocalePath();

// Prefix internal paths with the active locale; leave external URLs untouched.
const toLocale = (href?: string) =>
    href && href.startsWith('/') ? localePath(href) : href;
</script>

<template>
  <footer class="footer flex p-12 px-4 sm:px-6 lg:px-8">
    <u-container class="w-full max-w-[var(--ui-container)] mx-auto px-4 sm:px-6 lg:px-8
            flex flex-wrap gap-5 justify-center">
      <div class="footer__column">
        <div class="footer__col-item">
          <a class="footer__logo max-h-[35px] min-w-[160px]" :href="localePath('/')">
            <nuxt-img
                class="footer__logo-image"
                src="/images/logo.png"
                alt="Logo"
                format="png"
                quality="100"
                width="159"
                height="35"
                fit="contain"
                sizes="159px"
                :widths="[159, 318]"
                loading="lazy"
            />
          </a>
        </div>

        <div class="footer__col-item mt-6 mb-8">
          <p>{{ t('footer.about') }}</p>
        </div>

        <div class="footer__col-item">
          <newsletter/>
        </div>
      </div>

      <div class="footer__column">
        <div class="footer__col-item" v-for="menu in footerMenus">
          <h4 class="footer__title" v-if="menu?.titleKey">{{ t(menu.titleKey) }}</h4>
          <u-page-list class="footer__list" v-if="menu?.links">
            <li v-for="item in menu.links" :key="item.href">
              <a class="footer__link" :href="toLocale(item.href)">{{ t(item.labelKey) }}</a>
            </li>
          </u-page-list>
        </div>
      </div>

      <div class="footer__column" v-if="contacts && contacts?.length">
        <div class="footer__col-item">
          <h4 class="footer__title">{{ t('footer.contactTitle') }}</h4>

          <u-page-list class="footer__list footer__contact" :ui="{list: 'flex-row'}">
            <contact-item
                :contacts="contacts.filter((contact) => contact.type !== 'social' && contact.type !== 'other') || []"/>
          </u-page-list>
        </div>
      </div>
    </u-container>
  </footer>
</template>

<style scoped lang="scss">
.footer {
  background-color: var(--color-blackest);
}

.footer__column {
  flex: 100%;

  @media (min-width: 768px) {
    flex: calc(50% - 20px);
  }

  @media (min-width: 1024px) {
    flex: calc(33.3333% - 20px);
  }

  @media (min-width: 1280px) {
    flex: calc(25% - 20px);
  }
}

.footer__title {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.footer__list {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 8px;
}

.footer__link {
  display: inline-block;
  color: var(--color-link);
  line-height: 25px;
  transition: 0.3s;
  position: relative;

  &:after {
    position: absolute;
    content: "";
    left: auto;
    bottom: 0;
    background: currentColor;
    width: 0;
    height: 2px;
    transition: 0.3s;
    right: 0;
  }

  &:hover {
    color: var(--color-primary);

    &:after {
      width: 100%;
      left: 0;
      right: auto;
    }
  }
}

.footer__title {
  margin-bottom: 16px;
}

.footer__contact {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &-link {
    color: var(--color-gray-300);
    transition: color .2s ease;

    &:hover {
      color: var(--color-primary);
    }
  }
}

.footer__logo-image {
  filter: drop-shadow(0px 0px 12px var(--color-primary));
}

.light {
  .footer__logo-image {
    filter: drop-shadow(1px 1px 2px #5121f5);
  }
}
</style>