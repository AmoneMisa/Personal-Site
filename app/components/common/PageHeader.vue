<script setup lang="ts">
import { computed } from 'vue';

const { t } = useI18n();
const SIZE_TEXT_RE =
    /(?:^|\s)(?:[a-z]{2,3}:)?text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[^\]]+])(?:\s|$)/;

function hasTextSize(classes?: string) {
  return !!classes && SIZE_TEXT_RE.test(classes);
}
const customTitleSize = computed(() =>
    hasTextSize(props.titleClasses) || hasTextSize(props.ui.title)
);

const customDescriptionSize = computed(() =>
    hasTextSize(props.descriptionClasses) || hasTextSize(props.ui.description)
);

type UI = Partial<{
  root: string
  container: string
  headline: string
  title: string
  description: string
  links: string
}>;

const props = defineProps({
  description: String,
  headline: String,
  title: String,

  isMainHeader: { type: Boolean, default: false },

  isCentered: { type: Boolean, default: false },
  descriptionSize: { type: String, default: '16' },
  titleSize: { type: String, default: '48' },
  isFullWidth: { type: Boolean, default: true },

  headLineClasses: { type: String, default: '' },
  titleClasses: { type: String, default: '' },
  descriptionClasses: { type: String, default: '' },

  ui: { type: Object as () => UI, default: () => ({}) }
});

const titleTag = computed(() => (props.isMainHeader ? 'h1' : 'h2'));

const baseWidth = computed(() => (props.isFullWidth ? 'w-full max-w-none' : 'max-w-[390px]'));
const alignText = computed(() => (props.isCentered ? 'mx-auto text-center' : 'mx-0 text-left'));

const headlineClass = computed(() => [
  'page-header__headline',
  baseWidth.value,
  props.isCentered ? 'justify-center text-center' : 'text-left',
  'page-eyebrow whitespace-normal break-words [overflow-wrap:anywhere]',
  props.headLineClasses,
  props.ui.headline
].filter(Boolean).join(' '));

const titleSizeClass = computed(() =>
    props.titleSize === '48'
        ? 'text-3xl sm:text-4xl'
        : 'text-2xl sm:text-3xl'
);

const titleClass = computed(() => [
  'page-header__title',
  'whitespace-normal break-words [overflow-wrap:anywhere] leading-tight font-semibold text-highlighted',
  baseWidth.value,
  alignText.value,
  !customTitleSize.value ? titleSizeClass.value : '',
  props.titleClasses,
  props.ui.title
].filter(Boolean).join(' '));

const descriptionSizeClass = computed(() =>
    props.descriptionSize === '24' ? 'text-lg sm:text-xl' : 'text-base sm:text-md'
);

const descriptionClass = computed(() => [
  'page-header__description',
  baseWidth.value,
  alignText.value,
  'whitespace-normal break-words [overflow-wrap:anywhere]',
  !customDescriptionSize.value ? descriptionSizeClass.value : '',
  props.descriptionClasses,
  props.ui.description
].filter(Boolean).join(' '));
</script>

<template>
  <div
      :class="[
      'page-header border-0 py-0 my-0',
      ui.root,
      {
        'page-header_centered': isCentered,
        'm-auto': isCentered,
        'page-header_full-width': isFullWidth
      }
    ]"
  >
    <div :class="['page-header__container flex flex-col gap-3', ui.container]">
      <div v-if="headline" :class="headlineClass">
        {{ t(headline) }}
      </div>

      <component v-if="title" :is="titleTag" :class="titleClass">
        {{ t(title) }}
      </component>

      <div v-if="description" :class="descriptionClass">
        {{ t(description) }}
      </div>

      <div v-if="$slots.default" :class="['page-header__links', ui.links]">
        <slot />
      </div>
    </div>
  </div>
</template>
