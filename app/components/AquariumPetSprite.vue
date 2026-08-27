<script setup lang="ts">
import type { CreaturePreset } from "~/utils/aquariumCreatures";

defineProps<{ creature: CreaturePreset }>();
defineEmits<{ loaded: [] }>();

function handleImageError(event: Event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  image.style.display = "none";
}

function fishExpressionSrc(creature: CreaturePreset, expression: "interest" | "panic") {
  return `/images/ocean-creatures/${creature.id}-${expression}-animated.webp`;
}

function jellyMoodSrc(creature: CreaturePreset, mood: "sleep" | "play" | "angry") {
  return `/images/ocean-creatures/${creature.id}-${mood}-animated.webp`;
}
</script>

<template>
  <div class="aquarium-pet-sprite" :class="`aquarium-pet-sprite_${creature.kind}`" @error.capture="handleImageError">
    <template v-if="creature.kind === 'puffer'">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__puffer aquarium-pet-sprite__puffer_normal" :src="creature.src" alt="" draggable="false" @load="$emit('loaded')">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__puffer aquarium-pet-sprite__puffer_ball" src="/images/ocean-creatures/puffer-clean-animated.webp" alt="" draggable="false">
    </template>

    <template v-else-if="creature.kind === 'shark'">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_default" :src="creature.src" alt="" draggable="false" @load="$emit('loaded')">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_hunt" src="/images/ocean-creatures/shark-hunt.webp" alt="" draggable="false">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_interest" src="/images/ocean-creatures/shark-curious-animated.webp" alt="" draggable="false">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_panic" src="/images/ocean-creatures/shark-annoyed-animated.webp" alt="" draggable="false">
    </template>

    <template v-else-if="creature.kind === 'seahorse'">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_default" :src="creature.src" alt="" draggable="false" @load="$emit('loaded')">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_interest" src="/images/ocean-creatures/seahorse-heart-animated.webp" alt="" draggable="false">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_panic" src="/images/ocean-creatures/seahorse-tired-animated.webp" alt="" draggable="false">
    </template>

    <template v-else-if="creature.id === 'blue-fish' || creature.id === 'clownfish'">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_default" :src="creature.src" alt="" draggable="false" @load="$emit('loaded')">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_interest" :src="fishExpressionSrc(creature, 'interest')" alt="" draggable="false">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__expression aquarium-pet-sprite__expression_panic" :src="fishExpressionSrc(creature, 'panic')" alt="" draggable="false">
    </template>

    <template v-else-if="creature.kind === 'jelly'">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__jelly-base" :src="creature.src" alt="" draggable="false" @load="$emit('loaded')">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__jelly-mood aquarium-pet-sprite__jelly-mood_sleep" :src="jellyMoodSrc(creature, 'sleep')" alt="" draggable="false">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__jelly-mood aquarium-pet-sprite__jelly-mood_play" :src="jellyMoodSrc(creature, 'play')" alt="" draggable="false">
      <img class="aquarium-pet-sprite__image aquarium-pet-sprite__jelly-mood aquarium-pet-sprite__jelly-mood_angry" :src="jellyMoodSrc(creature, 'angry')" alt="" draggable="false">
    </template>

    <img v-else class="aquarium-pet-sprite__image" :src="creature.src" alt="" draggable="false" @load="$emit('loaded')">
  </div>
</template>

<style>
.aquarium-pet-sprite {
  position: relative;
  width: 100%;
  transform-origin: 50% 50%;
  will-change: transform;
}

.aquarium-pet-sprite_shark { aspect-ratio: 320 / 198; animation: aquarium-shark-swim var(--body-duration) cubic-bezier(.45,.05,.55,.95) infinite; }
.aquarium-pet-sprite_puffer { aspect-ratio: 240 / 148; animation: aquarium-puffer-breathe var(--body-duration) ease-in-out infinite; }
.aquarium-pet-sprite_fish { aspect-ratio: 3 / 2; animation: aquarium-fish-swim var(--body-duration) cubic-bezier(.45,.05,.55,.95) infinite; }
.aquarium-pet-sprite_seahorse { aspect-ratio: 140 / 240; transform-origin: 52% 46%; animation: aquarium-seahorse-drift var(--body-duration) cubic-bezier(.45,.05,.55,.95) infinite; }
.aquarium-pet-sprite_jelly { transform-origin: 50% 30%; animation: aquarium-jelly-body var(--body-duration) ease-in-out infinite; }
.underwater-2d__swimmer_jelly-blue .aquarium-pet-sprite { aspect-ratio: 105 / 120; }
.underwater-2d__swimmer_jelly-pink .aquarium-pet-sprite { aspect-ratio: 120 / 109; }

.aquarium-pet-sprite__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}

.aquarium-pet-sprite__puffer { transition: opacity 180ms ease; }
.aquarium-pet-sprite__puffer_normal { opacity: calc(1 - var(--inflation)); }
.aquarium-pet-sprite__puffer_ball { opacity: var(--inflation); }
.aquarium-pet-sprite__expression_default { opacity: 1; }
.aquarium-pet-sprite__expression_hunt,
.aquarium-pet-sprite__expression_interest,
.aquarium-pet-sprite__expression_panic,
.aquarium-pet-sprite__jelly-mood { opacity: 0; }
.underwater-2d__swimmer_shark[data-behavior="hunt"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_shark[data-behavior="interest"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_shark[data-behavior="panic"] .aquarium-pet-sprite__expression_default { opacity: 0; }
.underwater-2d__swimmer_shark[data-behavior="hunt"] .aquarium-pet-sprite__expression_hunt,
.underwater-2d__swimmer_shark[data-behavior="interest"] .aquarium-pet-sprite__expression_interest,
.underwater-2d__swimmer_shark[data-behavior="panic"] .aquarium-pet-sprite__expression_panic { opacity: 1; }

.underwater-2d__swimmer_seahorse[data-behavior="interest"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_seahorse[data-behavior="panic"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_seahorse[data-behavior="flee"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_blue-fish[data-behavior="interest"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_blue-fish[data-behavior="panic"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_blue-fish[data-behavior="flee"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_clownfish[data-behavior="interest"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_clownfish[data-behavior="panic"] .aquarium-pet-sprite__expression_default,
.underwater-2d__swimmer_clownfish[data-behavior="flee"] .aquarium-pet-sprite__expression_default { opacity: 0; }
.underwater-2d__swimmer_seahorse[data-behavior="interest"] .aquarium-pet-sprite__expression_interest,
.underwater-2d__swimmer_blue-fish[data-behavior="interest"] .aquarium-pet-sprite__expression_interest,
.underwater-2d__swimmer_clownfish[data-behavior="interest"] .aquarium-pet-sprite__expression_interest { opacity: 1; }
.underwater-2d__swimmer_seahorse[data-behavior="panic"] .aquarium-pet-sprite__expression_panic,
.underwater-2d__swimmer_seahorse[data-behavior="flee"] .aquarium-pet-sprite__expression_panic,
.underwater-2d__swimmer_blue-fish[data-behavior="panic"] .aquarium-pet-sprite__expression_panic,
.underwater-2d__swimmer_blue-fish[data-behavior="flee"] .aquarium-pet-sprite__expression_panic,
.underwater-2d__swimmer_clownfish[data-behavior="panic"] .aquarium-pet-sprite__expression_panic,
.underwater-2d__swimmer_clownfish[data-behavior="flee"] .aquarium-pet-sprite__expression_panic { opacity: 1; }

.underwater-2d__swimmer[data-mood="sleep"] .aquarium-pet-sprite__jelly-base,
.underwater-2d__swimmer[data-mood="play"] .aquarium-pet-sprite__jelly-base,
.underwater-2d__swimmer[data-mood="angry"] .aquarium-pet-sprite__jelly-base { opacity: 0; }
.underwater-2d__swimmer[data-mood="sleep"] .aquarium-pet-sprite__jelly-mood_sleep,
.underwater-2d__swimmer[data-mood="play"] .aquarium-pet-sprite__jelly-mood_play,
.underwater-2d__swimmer[data-mood="angry"] .aquarium-pet-sprite__jelly-mood_angry { opacity: 1; }

@keyframes aquarium-shark-swim { 0%, 100% { transform: translateY(-2px) rotate(-.7deg); } 50% { transform: translateY(2px) rotate(.7deg); } }
@keyframes aquarium-fish-swim { 0%, 100% { transform: translateY(-2px) rotate(-1.3deg) scaleX(.985); } 50% { transform: translateY(2px) rotate(1.3deg) scaleX(1.015); } }
@keyframes aquarium-puffer-breathe { 0%, 100% { transform: translateY(-2px) skewY(-1.4deg) scale(1) rotate(-1deg); } 48% { transform: translateY(2px) skewY(1.4deg) scale(1.035, 1.05) rotate(1deg); } }
@keyframes aquarium-seahorse-drift { 0%, 100% { transform: rotate(-5deg) skewX(-1.8deg) translateY(-4px) scaleY(.985); } 25%, 75% { transform: rotate(0) skewX(0) translateY(0) scaleY(1); } 50% { transform: rotate(5deg) skewX(1.8deg) translateY(4px) scaleY(1.02); } }
@keyframes aquarium-jelly-body { 0%, 100% { transform: translateY(1px) rotate(-.7deg); } 50% { transform: translateY(-3px) rotate(.7deg); } }

@media (prefers-reduced-motion: reduce) {
  .aquarium-pet-sprite { animation: none !important; }
}
</style>
