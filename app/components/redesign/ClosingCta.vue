<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const c = computed(() => content.value.closingCta);
const localePath = useLocalePath();
</script>

<template>
  <section class="rd-section closing">
    <div class="rd-wrap">
      <p class="closing-text">{{ c.text }}</p>
      <div class="closing-cta">
        <a class="btn-primary" href="#contact">{{ c.contactLabel }}</a>
        <a class="btn-text" :href="localePath('/cv')">{{ c.cvLabel }} →</a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.closing-text {
  max-width: 640px;
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-soft);
}
.closing-cta {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 26px;
}
.btn-primary {
  background: var(--accent-pink);
  color: #1a0e14;
  font-weight: 500;
  padding: 11px 22px;
  border-radius: 6px;
  font-size: 14.5px;
}
.btn-primary:hover {
  filter: brightness(1.06);
}
.btn-text {
  color: var(--text-primary);
  font-size: 14.5px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2px;
}
.btn-text:hover {
  border-color: var(--text-primary);
}
</style>
