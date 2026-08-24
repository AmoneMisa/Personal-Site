<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "reef" | "treasure" | "home";
}>(), {
  variant: "reef",
});
</script>

<template>
  <div
    class="ocean-page-backdrop"
    :class="`ocean-page-backdrop_${variant}`"
    aria-hidden="true"
  />
</template>

<style scoped>
.ocean-page-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-color: #05091d;
  background-image:
    linear-gradient(180deg, rgba(4, 8, 28, 0.38) 0%, rgba(4, 8, 28, 0.54) 54%, rgba(4, 8, 28, 0.76) 100%),
    var(--ocean-page-image);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
}

.ocean-page-backdrop_reef {
  --ocean-page-image: url("/images/easter-eggs/ocean-page-reef.webp");
  --ocean-page-mobile-position: 66% top;
}

.ocean-page-backdrop_treasure {
  --ocean-page-image: url("/images/easter-eggs/ocean-page-treasure.webp");
  --ocean-page-mobile-position: 69% top;
}

.ocean-page-backdrop_home {
  --ocean-page-image: url("/images/easter-eggs/ocean-page-home.webp");
  --ocean-page-mobile-position: 70% top;
}

@media (max-width: 720px) {
  .ocean-page-backdrop {
    background-position: var(--ocean-page-mobile-position, 66% top);
  }
}
</style>
