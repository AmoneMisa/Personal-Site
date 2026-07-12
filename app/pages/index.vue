<script setup lang="ts">
import TextareaRequestForm from "~/components/common/TextareaRequestForm.vue";
import FeaturesCarousel from "~/components/FeaturesCarousel.vue";
import TabsWithUnderButtons from "~/components/TabsWithUnderButtons.vue";
import ImagesCarousel from "~/components/ImagesCarousel.vue";
import {safeFetch} from "~/utils/safeFetch";
import type FeatureCardInterface from "~/interfaces/FeatureCardInterface";
import PageHeader from "~/components/common/PageHeader.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import type TestimonialInterface from "~/interfaces/TestimonialInterface";

const {t} = useI18n();

useSeoMeta({
  title: () => t('seo.pages.home.title'),
  description: () => t('seo.pages.home.description'),
  robots: () => t('seo.common.robots'),
  ogType: () => t('seo.common.ogType'),
  ogSiteName: () => t('seo.common.siteName'),
  ogTitle: () => t('seo.pages.home.ogTitle'),
  ogDescription: () => t('seo.pages.home.ogDescription'),
  twitterCard: () => t('seo.common.twitterCard'),
  twitterTitle: () => t('seo.pages.home.twitterTitle'),
  twitterDescription: () => t('seo.pages.home.twitterDescription')
});
const isPageLoaded = ref(false);

onMounted(() => {
  const markLoaded = () => { isPageLoaded.value = true }

  if (document.readyState === 'complete') {
    markLoaded();
  } else {
    window.addEventListener('load', markLoaded, { once: true });
  }
});

const cards = [
  {
    title: 'cards.ask.title',
    description: 'cards.ask.description',
    icon: '/svg/service-icon-01.svg'
  },
  {
    title: 'cards.connect.title',
    description: 'cards.connect.description',
    icon: '/svg/service-icon-02.svg'
  },
  {
    title: 'cards.fast.title',
    description: 'cards.fast.description',
    icon: '/svg/service-icon-03.svg'
  }
];
const config = useRuntimeConfig();

const {data: featureCards} = await useAsyncData(
    'featureCards',
    async () => (await safeFetch<FeatureCardInterface[]>(`${config.public.apiBase}/feature-cards`)).data ?? [],
    {default: () => []}
);

const {data: testimonials} = await useAsyncData(
    'testimonials',
    async () => (await safeFetch<TestimonialInterface[]>(`${config.public.apiBase}/testimonials`)).data ?? [],
    {default: () => [], server: true}
);

const {data: tabs} = await useAsyncData(
    'tabsWithBackground',
    async () => {
      const {data} = await safeFetch(`${config.public.apiBase}/tabs`)
      return data ?? {withBackground: [], underbutton: []}
    },
    {server: true, default: () => ({withBackground: [], underbutton: []})}
);

const withBackgroundTabs = computed(() => tabs.value?.withBackground ?? []);
const underbuttonTabs = computed(() => tabs.value?.underbutton ?? []);

interface AnimatedTextItem {
  id: string;
  titleKey: string;
  isVisible: boolean;
  order: number;
}

const {data: animatedText} = await useAsyncData<AnimatedTextItem[]>(
    'animatedText',
    async () => {
      const {data} = await safeFetch<AnimatedTextItem[]>(`${config.public.apiBase}/animated-text`)
      return data ?? [];
    },
    {server: true, default: () => []}
);
</script>

<template>
  <u-page :ui="{center: 'flex flex-col gap-[28px] lg:gap-[32px] xl:gap-[40px] py-12'}">
    <div>
      <h1 class="page-main-header mx-auto max-w-[22ch] text-center font-bold tracking-tight leading-[0.95] text-[clamp(2.25rem,5vw,3.5rem)]">
        <span class="block dark:text-white/90 text-[var(--ui-text)]/90">{{ t('hero.title') }}</span>
        <span class="mt-2 block">
            <animated-rotated-x-text v-if="animatedText && animatedText?.length" class="align-baseline"
                                     :texts-list="animatedText"/>
        </span>
      </h1>
      <page-header description="hero.subtitle" descriptionSize="24" class="mt-2" :is-centered="true"/>
    </div>
    <u-page-body class="mt-4 pb-0 gap-16 flex flex-col justify-center">
      <textarea-request-form
          :placeholder="t('form.placeholder')"
          :button-text="t('form.button')"
      />
      <u-container class="max-w-6xl mx-auto admin-panel">
        <div class="admin-panel__image">
          <h2 class="text-pretty font-bold text-highlighted mx-auto whitespace-normal [overflow-wrap:anywhere] text-3xl sm:text-4xl lg:text-5xl mb-9 gradient-text text-center">
            {{ t('adminPanel.title') }}</h2>
          <nuxt-img
              class="w-full rounded-lg"
              src="/images/admin-panel.png"
              alt="Admin panel"
              format="webp"
              :quality="80"
              width="2536"
              height="1340"
              sizes="(max-width: 1024px) 100vw, 988px"
              :widths="[480, 640, 768, 988, 1200, 1976]"
              fetchpriority="high"
          />
        </div>
      </u-container>
      <u-container class="flex items-center flex-col justify-center min-w-0 mb-0">
        <h2 class="text-2xl font-semibold text-center text-muted uppercase mb-8">{{ t('trust.title') }}</h2>
        <images-carousel :images="[
            '/images/intellij.png',
            '/images/restapi.png',
            '/images/jira.png',
            '/images/docker.png',
            '/images/jenkins.png',
            '/images/github.png',
            '/images/cicd.png',
            '/images/gitlab.png',
            '/images/confluence.png'
        ]"/>
      </u-container>
      <tabs-with-background :tabs="withBackgroundTabs" title="page.tabsWithBackground.title"
                            headline="page.tabsWithBackground.headline"/>
      <features-carousel :cards="cards" button-text="page.featuresCarousel.button"/>
      <tabs-with-under-buttons class="bg-full" :tabs="underbuttonTabs"/>
      <u-container class="flex flex-col justify-center">
        <page-header
            title="page.collaboration.title"
            headline="page.collaboration.headline"
            titleClasses="max-w-[530px]"
            :is-centered="true"
        />
        <div class="relative logo-shadow" :class="{'logo-shadow_animated': isPageLoaded}">
          <div
              class="logo-shadow__logo absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:px-12 sm:py-8 px-6 py-4 rounded-xl ring-2 dark:ring-neutral-900 ring-[#d1d1ff] max-w-[330px]">
            <nuxt-img
                class="letter-logo"
                src="/images/letter-logo.png"
                alt="Letter Logo"
                format="png"
                :quality="80"
                width="234"
                height="154"
                fit="contain"
                sizes="(max-width: 480px) 80px,
         (max-width: 768px) 120px,
         234px"
                :widths="[80, 120, 160, 200, 234, 320, 468]"
                loading="lazy"
            />
          </div>
          <nuxt-img
              class="w-fill-available"
              src="/images/split-2-background.png"
              alt="Letter Logo Background"
              format="webp"
              :quality="80"
              width="1536"
              height="1024"
              sizes="(max-width: 1152px) 100vw, 1152px"
              :widths="[480, 768, 1024, 1152, 1440, 2304]"
              loading="lazy"
          />
        </div>
      </u-container>

      <u-container
          class="violet-block rounded-xl flex flex-col lg:flex-row justify-between py-10 lg:py-16 gap-8 lg:gap-0 max-h-none lg:max-h-[265px] mb-0">
        <page-header class="border-none max-w-full lg:max-w-[590px] py-0"
                     title="page.community.title"
                     description="page.community.description"
                     :ui="{
              description: 'text-white'
            }"/>
        <div class="items-center justify-center lg:justify-start hidden lg:flex">
          <nuxt-img
              src="/images/bg-shape-01.png"
              :alt="t('page.community.title')"
              format="webp"
              quality="80"
              width="368"
              height="212"
              sizes="184px"
              :widths="[92, 184, 368]"
              loading="lazy"
          />
        </div>
        <u-container class="w-full lg:w-1/4 gap-6 flex flex-col items-center justify-center">
          <nuxt-img
              class="flex-none mx-auto w-[120px]"
              src="/images/myself.png"
              alt="My GitHub"
              format="png"
              quality="100"
              width="120"
              height="113"
              fit="cover"
              sizes="120px"
              :widths="[120, 240]"
              loading="lazy"
          />
          <a href="https://github.com/AmoneMisa" target="_blank" rel="noopener noreferrer">
            <custom-button class="justify-center h-12 text-base w-max" button-type="white">
              {{ t('page.community.cta') }}
            </custom-button>
          </a>
        </u-container>
      </u-container>

      <u-container class="mb-0">
        <price-cards/>
      </u-container>
      <u-container class="mb-0 flex flex-col lg:flex-row gap-8 lg:gap-20">
        <service-cards-grid :cards="(featureCards || []).filter((featureCard) => featureCard.isVisible)"/>
      </u-container>
      <testimonial-carousel headline="testimonials.headline" title="testimonials.title"
                            :testimonials="(testimonials || []).filter((testimonial) => testimonial.isVisible)"
      />
      <review-logos
          title="page.reviewLogos.title"
          :logos="[
    { src: '/images/electron-gradient.png', alt: 'electron' },
    { src: '/images/nuxt-gradient.png', alt: 'nuxt' },
    { src: '/images/vue-gradient.png', alt: 'vue' },
    { src: '/images/postgre-gradient.png', alt: 'postgreSql' },
    { src: '/images/scss-gradient.png', alt: 'scss' }
  ]"/>
      <app-download-promo headline="download.headline" title="download.title" description="download.description"/>
    </u-page-body>
  </u-page>
</template>

<style scoped lang="scss">
.violet-block {
  padding: 50px 80px 60px;
  /* Slightly deeper purple than --color-primary (#805AF5) so white text meets
     WCAG AA 4.5:1 (raises ~4.47:1 -> ~5.7:1); same hue, minimal visual change. */
  background-color: #6c47e8;
}

.logo-shadow {
  &:before {
    content: "";
    background: linear-gradient(133deg, #ADFA4B 1.34%, #9872EA 1.35%, #4D72F5 76.16%, #FA11FF 105.35%);
    filter: blur(32.5px);
    background-size: 400%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    z-index: -2;
    width: 320px;
    height: 320px;
    border-radius: 24px;

    @media screen and (max-width: 768px) {
      width: 260px;
      height: 260px;
    }

    @media screen and (max-width: 420px) {
      width: 240px;
      height: 240px;
    }
  }
}

.logo-shadow_animated {
  animation: styles_moving-gradient 16s linear infinite;
}

.logo-shadow__logo {
  background-color: var(--background-color);
}

.admin-panel {
  padding-right: calc(1.5rem * .5);
  padding-left: calc(1.5rem * .5);
  margin-top: 0;
  margin-bottom: 0;
}

.admin-panel__image {
  background-size: contain;
  background: url('/images/slider-main-bg.png') no-repeat top center;
  padding: 70px 70px 42px;
  position: relative;
  z-index: 3;
  overflow: hidden;
  border-radius: 12px;
  max-width: 100%;
  background-size: cover;

  &:before {
    content: "";
    position: absolute;
    height: 100%;
    width: 100%;
    top: -40%;
    left: 50%;
    transform: translateX(-50%);
    background: url('/images/main-banner-bg-shape.png');
    z-index: -5;
  }

  @media (max-width: 1024px) {
    padding: 30px 30px 12px;
  }
}
</style>
