<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import {safeFetch} from "~/utils/safeFetch";
import type {ServiceType} from "~/types/ServiceType";

const {t} = useI18n();
const config = useRuntimeConfig();

useSeoMeta({
  title: () => t('seo.pages.services.title'),
  description: () => t('seo.pages.services.description'),
  robots: () => t('seo.common.robots'),
  ogType: "website",
  ogSiteName: () => t('seo.common.siteName'),
  ogTitle: () => t('seo.pages.services.ogTitle'),
  ogDescription: () => t('seo.pages.services.ogDescription')
});

const {data: rawServicesData} = await safeFetch<ServiceType[]>(
    `${config.public.apiBase}/services`
);
const {data: serviceCategoriesData} = await safeFetch<any[]>(
    `${config.public.apiBase}/service-categories`
);

const rawServices = computed(() => Array.isArray(rawServicesData) ? rawServicesData : []);
const serviceCategories = computed(() => Array.isArray(serviceCategoriesData) ? serviceCategoriesData : []);
const services = computed(() => {
  const raw = rawServices.value;

  if (!Array.isArray(raw)) return [];

  return raw;
});

const query = ref('');
const activeCategory = ref<'all' | string>('all');

const filteredServices = computed(() => {
  const list = services.value.filter(s => activeCategory.value === 'all' || s.categoryId === activeCategory.value);

  return [...list];
});

const howSteps = [
  {icon: 'i-lucide-mouse-pointer-click', titleKey: 'services.how.step1.title', textKey: 'services.how.step1.text'},
  {icon: 'i-lucide-sliders-horizontal', titleKey: 'services.how.step2.title', textKey: 'services.how.step2.text'},
  {icon: 'i-lucide-check-circle', titleKey: 'services.how.step3.title', textKey: 'services.how.step3.text'}
];
</script>

<template>
  <u-container class="services">
    <div class="services__header text-center space-y-3">
      <page-header
          title="services.title"
          headline="services.headline"
          class="mb-6"
      />

      <p class="services__subtitle text-muted mx-auto">
        {{ t('services.subtitle') }}
      </p>
    </div>

    <div class="services__controls">
      <div class="services__search">
        <u-input
            icon="i-lucide-search"
            :placeholder="t('services.searchPlaceholder')"
            v-model="query"
        />
      </div>

      <div class="services__filters" v-if="serviceCategories">
        <button
            type="button"
            class="services__pill"
            :class="{ 'services__pill_active': activeCategory === 'all' }"
            @click="activeCategory = 'all'"
        >
          {{ t("services.filters.all") }}
        </button>
        <button
            v-for="c in serviceCategories"
            :key="c.id"
            type="button"
            class="services__pill"
            :class="{ 'services__pill_active': activeCategory === c.id }"
            @click="activeCategory = c.id"
        >
          {{ t(c.titleKey) }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" v-if="filteredServices">
      <service-card
          v-for="s in filteredServices"
          :key="s.id"
          :image="s.image"
          :title="s.titleKey"
          :description="s.descriptionKey"
          :link="s.link"
      />
    </div>

    <div v-if="filteredServices.length === 0" class="services__empty">
      <div class="services__empty-title">{{ t('services.empty.title') }}</div>
      <div class="text-muted">{{ t('services.empty.text') }}</div>
    </div>

    <section class="services__how">
      <h2 class="services__h2">{{ t('services.howTitle') }}</h2>

      <div class="services__how-grid">
        <div class="how-card" v-for="step in howSteps" :key="step.titleKey">
          <u-icon :name="step.icon" class="how-card__icon"/>
          <div class="how-card__title">{{ t(step.titleKey) }}</div>
          <div class="how-card__text text-muted">{{ t(step.textKey) }}</div>
        </div>
      </div>
    </section>
  </u-container>
</template>

<style scoped>
.services {
  padding-top: 24px;
  padding-bottom: 96px;
}

.services__subtitle {
  max-width: 720px;
  font-size: 14px;
}

.services__controls {
  margin: 28px 0 28px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 900px) {
    grid-template-columns: 1fr auto auto;
    align-items: center;
  }
}

.services__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;

  @media (min-width: 900px) {
    justify-content: flex-start;
  }
}

.services__pill {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: filter 180ms ease, transform 140ms ease, color 180ms ease;
}

.services__pill:hover {
  filter: brightness(1.06);
  color: var(--text-white);
}

.services__pill:active {
  transform: translateY(1px);
}

.services__pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(128, 90, 245, 0.30),
  0 0 0 6px rgba(128, 90, 245, 0.14);
}

.services__pill_active {
  color: var(--text-white);
  border-color: rgba(128, 90, 245, 0.40);
  background: rgba(128, 90, 245, 0.18);
}

.services__empty {
  margin-top: 18px;
  text-align: center;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
}

.services__empty-title {
  font-weight: 900;
  margin-bottom: 6px;
}

.services__how {
  margin-top: 84px;
  text-align: center;
}

.services__h2 {
  font-size: 28px;
  font-weight: 900;
  margin-bottom: 18px;
}

.services__how-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @media (min-width: 800px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.how-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.how-card__icon {
  font-size: 22px;
  color: var(--color-primary);
  margin-bottom: 10px;
}

.how-card__title {
  font-weight: 900;
  margin-bottom: 6px;
}
</style>
