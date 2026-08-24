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
    linear-gradient(180deg, rgba(4, 8, 28, 0.28) 0%, rgba(4, 8, 28, 0.48) 54%, rgba(4, 8, 28, 0.72) 100%),
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
