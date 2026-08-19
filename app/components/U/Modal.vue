<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UModal>.
//
// Supports `v-model:open`, `title`, `dismissible`, and the #body / #footer /
// #content / #default slots the app uses. Scroll locking is done here and
// always released on close or unmount — the previous implementation could
// strand a locked page on mobile when a nested overlay closed out of order.
import { onBeforeUnmount, watch } from "vue";

const props = withDefaults(defineProps<{
  open?: boolean;
  title?: string;
  description?: string;
  dismissible?: boolean;
  ui?: unknown;
}>(), { dismissible: true });

const emit = defineEmits<{ (e: "update:open", value: boolean): void }>();

let restoreScroll: (() => void) | null = null;

function lockScroll() {
  if (import.meta.server || restoreScroll) return;
  const { body } = document;
  const previousOverflow = body.style.overflow;
  const previousPadding = body.style.paddingRight;
  // Compensate for the scrollbar so the page doesn't shift when it disappears.
  const gap = window.innerWidth - document.documentElement.clientWidth;
  body.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${gap}px`;
  restoreScroll = () => {
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPadding;
  };
}

function unlockScroll() {
  restoreScroll?.();
  restoreScroll = null;
}

function close() {
  if (!props.dismissible) return;
  emit("update:open", false);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}

watch(() => props.open, (isOpen) => {
  if (import.meta.server) return;
  if (isOpen) {
    lockScroll();
    document.addEventListener("keydown", onKeydown);
  } else {
    unlockScroll();
    document.removeEventListener("keydown", onKeydown);
  }
}, { immediate: true });

// Leaving the page with the modal open must never strand a locked document.
onBeforeUnmount(() => {
  unlockScroll();
  if (!import.meta.server) document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <slot />
  <Teleport v-if="open" to="body">
    <div class="u-modal" role="dialog" aria-modal="true" :aria-label="title || undefined">
      <div class="u-modal__backdrop" @click="close" />
      <div class="u-modal__panel" :class="$attrs.class">
        <!-- #content replaces the whole panel, matching Nuxt UI. -->
        <slot v-if="$slots.content" name="content" />
        <template v-else>
          <header v-if="title || dismissible" class="u-modal__header">
            <h2 v-if="title" class="u-modal__title">{{ title }}</h2>
            <button v-if="dismissible" type="button" class="u-modal__close ui-focusable" aria-label="Close" @click="close">
              <UIcon name="i-lucide-x" />
            </button>
          </header>
          <div class="u-modal__body"><slot name="body" /></div>
          <footer v-if="$slots.footer" class="u-modal__footer"><slot name="footer" /></footer>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.u-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.u-modal__backdrop { position: absolute; inset: 0; background: rgba(4, 6, 18, 0.72); }

.u-modal__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  max-height: calc(100dvh - 32px);
  border: 1px solid var(--line, #252a4a);
  border-radius: var(--radius, 10px);
  background: var(--bg-panel, #131730);
  color: var(--text-primary, #eef0f7);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.u-modal__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--line);
}
.u-modal__title { flex: 1 1 auto; margin: 0; font-size: 17px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }

.u-modal__close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
}
.u-modal__close:hover { background: rgba(255, 255, 255, 0.08); }

.u-modal__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px; }
.u-modal__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
}
</style>
