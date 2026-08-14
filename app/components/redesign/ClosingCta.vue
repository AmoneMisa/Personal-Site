<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const c = computed(() => content.value.closingCta);
const localePath = useLocalePath();
</script>

<template>
  <section class="rd-section closing-cta">
    <div class="rd-wrap">
      <p class="closing-cta__text">{{ c.text }}</p>
      <div class="closing-cta__actions">
        <a class="closing-cta__button closing-cta__button_primary" href="#contact">{{ c.contactLabel }}</a>
        <a class="closing-cta__button closing-cta__button_text" :href="localePath('/cv')">{{ c.cvLabel }} →</a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.closing-cta__text {
  max-width: 640px;
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-soft);
}
.closing-cta__actions {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 26px;
}
.closing-cta__button_primary {
  background: var(--accent-pink);
  color: #1a0e14;
  font-weight: 500;
  padding: 11px 22px;
  border-radius: 6px;
  font-size: 14.5px;
}
.closing-cta__button_primary:hover {
  filter: brightness(1.06);
}
.closing-cta__button_text {
  color: var(--text-primary);
  font-size: 14.5px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2px;
}
.closing-cta__button_text:hover {
  border-color: var(--text-primary);
}
</style>
