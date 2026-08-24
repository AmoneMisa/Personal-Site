<template>
  <div class="ocean-page-backdrop" aria-hidden="true" />
</template>

<style scoped>
.ocean-page-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-color: #05091d;
  background-image:
    radial-gradient(circle at 8% 34%, rgba(75, 145, 255, 0.16) 0 2px, transparent 3px),
    radial-gradient(circle at 92% 26%, rgba(118, 83, 226, 0.14) 0 3px, transparent 4px),
    linear-gradient(180deg, rgba(4, 8, 28, 0.38) 0%, rgba(4, 8, 28, 0.54) 54%, rgba(4, 8, 28, 0.76) 100%),
    url("/images/easter-eggs/ocean-page-background.webp");
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
}

@media (max-width: 720px) {
  .ocean-page-backdrop {
    background-position: 62% top;
  }
}
</style>
