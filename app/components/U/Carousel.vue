<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UCarousel>.
//
// Nuxt UI wrapped Embla; the only thing our wrapper (components/common/
// Carousel.vue) actually calls is `emblaApi.scrollPrev()` / `scrollNext()`, so
// this exposes an object of that shape backed by native CSS scroll-snap. That
// keeps the wrapper untouched and drops the Embla dependency along with Nuxt UI.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{
  items?: any[];
  loop?: boolean;
  autoplay?: boolean | { delay?: number };
  arrows?: boolean;
  dots?: boolean;
  indicators?: boolean;
  ui?: unknown;
}>(), { items: () => [] });

const viewport = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

function slideWidth(): number {
  const el = viewport.value;
  if (!el) return 0;
  const first = el.firstElementChild as HTMLElement | null;
  // Fall back to the viewport width when there is nothing to measure.
  return first ? first.getBoundingClientRect().width + 16 : el.clientWidth;
}

function scrollBySlides(direction: -1 | 1) {
  const el = viewport.value;
  if (!el) return;
  const step = slideWidth();
  const atEnd = direction === 1 && Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth - 1;
  const atStart = direction === -1 && el.scrollLeft <= 1;
  if (props.loop && atEnd) { el.scrollTo({ left: 0, behavior: "smooth" }); return; }
  if (props.loop && atStart) { el.scrollTo({ left: el.scrollWidth, behavior: "smooth" }); return; }
  el.scrollBy({ left: step * direction, behavior: "smooth" });
}

// The shape components/common/Carousel.vue drives.
const emblaApi = { scrollPrev: () => scrollBySlides(-1), scrollNext: () => scrollBySlides(1) };
defineExpose({ emblaApi });

const autoplayDelay = computed(() => {
  if (!props.autoplay) return 0;
  return typeof props.autoplay === "object" ? props.autoplay.delay ?? 4000 : 4000;
});

onMounted(() => {
  if (!autoplayDelay.value) return;
  timer = setInterval(() => scrollBySlides(1), autoplayDelay.value);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="u-carousel">
    <button v-if="arrows" type="button" class="u-carousel__arrow u-carousel__arrow_prev" aria-label="Previous" @click="emblaApi.scrollPrev()">
      <UIcon name="i-lucide-chevron-left" />
    </button>
    <div ref="viewport" class="u-carousel__viewport">
      <div v-for="(item, index) in items" :key="index" class="u-carousel__slide">
        <slot :item="item" :index="index" />
      </div>
    </div>
    <button v-if="arrows" type="button" class="u-carousel__arrow u-carousel__arrow_next" aria-label="Next" @click="emblaApi.scrollNext()">
      <UIcon name="i-lucide-chevron-right" />
    </button>
  </div>
</template>

<style scoped>
.u-carousel { position: relative; display: flex; align-items: center; min-width: 0; }

.u-carousel__viewport {
  display: flex;
  gap: 16px;
  width: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.u-carousel__viewport::-webkit-scrollbar { display: none; }
.u-carousel__slide { flex: 0 0 auto; scroll-snap-align: start; min-width: 0; }

.u-carousel__arrow {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line, #252a4a);
  border-radius: 50%;
  background: var(--bg-panel, #131730);
  color: inherit;
  cursor: pointer;
}
.u-carousel__arrow_prev { left: -8px; }
.u-carousel__arrow_next { right: -8px; }

@media (prefers-reduced-motion: reduce) {
  .u-carousel__viewport { scroll-behavior: auto; }
}
</style>
