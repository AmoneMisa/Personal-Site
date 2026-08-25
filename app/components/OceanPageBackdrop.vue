<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "reef" | "treasure" | "home" | "ambient";
}>(), {
  variant: "reef",
});
</script>

<template>
  <div
    class="ocean-page-backdrop"
    :class="`ocean-page-backdrop_${variant}`"
    aria-hidden="true"
  >
    <underwater-ambient />
  </div>
</template>

<style scoped>
.ocean-page-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  isolation: isolate;
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

.ocean-page-backdrop_ambient {
  background:
    radial-gradient(circle at 82% 18%, rgba(37, 117, 221, 0.12), transparent 25%),
    radial-gradient(circle at 12% 84%, rgba(138, 68, 209, 0.12), transparent 28%),
    radial-gradient(circle at 58% 4%, rgba(241, 73, 157, 0.07), transparent 25%),
    #070c22;
}

.ocean-page-backdrop_ambient::before,
.ocean-page-backdrop_ambient::after {
  content: "";
  position: absolute;
  z-index: -1;
  border: 1px solid rgba(75, 145, 255, 0.22);
  border-radius: 999px;
}
.ocean-page-backdrop_ambient::before { width: 10px; height: 10px; left: 7%; top: 34%; box-shadow: 32px 42px 0 3px rgba(67,119,221,.09),105px 420px 0 5px rgba(66,172,255,.08); }
.ocean-page-backdrop_ambient::after { width: 8px; height: 8px; right: 8%; top: 26%; box-shadow: -42px 54px 0 2px rgba(64,157,255,.08),16px 190px 0 4px rgba(118,83,226,.08); }

@media (max-width: 720px) {
  .ocean-page-backdrop {
    background-position: var(--ocean-page-mobile-position, 66% top);
  }
}
</style>
