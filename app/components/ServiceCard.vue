<script setup lang="ts">
import {NuxtLink} from "#components";

defineProps<{
  image: string
  title: string
  description: string
  link?: { name: string; params?: Record<string, any> }
}>();

const {t} = useI18n();
const localeRoute = useLocaleRoute();

// Resolve the target to the active locale's route. Handles both string paths
// ("/services/pdf-editor" from the API) and named-route objects; external URLs
// (http...) and in-page hashes pass through untouched.
function resolveLink(l: any) {
  if (!l) return undefined;
  if (typeof l === 'string' && !l.startsWith('/')) return l;
  return localeRoute(l) ?? l;
}
</script>

<template>
  <component
      :is="link ? NuxtLink : 'div'"
      :to="resolveLink(link)"
      class="block"
      style="text-decoration: none"
  >
    <u-card
        :ui="{
        root: 'ring-0 bg-transparent p-0',
        body: 'ui-anim-border group rounded-2xl p-[1.5px] sm:p-[1.5px] transition-transform hover:-translate-y-1'
      }"
    >
      <div
          class="ui-anim-border__inner flex h-full flex-col items-center gap-3 rounded-[calc(theme(borderRadius.2xl)-1.5px)] px-5 py-5 text-center sm:px-6 sm:py-6"
      >
        <div
            class="grid place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] size-12 sm:size-14"
        >
          <nuxt-img
              class="h-full w-full object-cover"
              :src="image"
              :alt="t(title)"
              format="webp"
              quality="100"
              width="55"
              height="55"
              fit="contain"
              sizes="55px"
              :widths="[55, 110]"
              loading="lazy"
              decoding="async"
          />
        </div>

        <h3 class="dark:text-white/95 text-[var(--ui-color)]/95 font-semibold leading-snug text-base sm:text-lg max-w-full line-clamp-2 break-words">
          {{ t(title) }}
        </h3>

        <p class="dark:text-white/65 text-[var(--ui-color)]/65 text-sm sm:text-[15px] leading-relaxed max-w-full line-clamp-3 break-words">
          {{ t(description) }}
        </p>
      </div>
    </u-card>
  </component>
</template>

<style>
.ui-anim-border {
  background: linear-gradient(
      90deg,
      rgba(128, 90, 245, 0.75),
      rgba(255, 255, 255, 0.10),
      rgba(205, 153, 255, 0.65),
      rgba(128, 90, 245, 0.75)
  );
  background-size: 300% 100%;
  animation: uiBorderFlow 5.5s linear infinite;
}

.ui-anim-border__inner {
  background: rgba(14, 12, 21, 0.92);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.35),
  inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

@keyframes uiBorderFlow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 300% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-anim-border {
    animation: none;
  }
}

.light {
  .ui-anim-border__inner {
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(12px) saturate(180%);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset 0 -4px 12px rgba(0, 0, 0, 0.06),
    inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }
}
</style>
