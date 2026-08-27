<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UModal>.
//
// Supports `v-model:open`, `title`, `dismissible`, and the #body / #footer /
// #content / #default slots the app uses. Scroll locking is done here and
// always released on close or unmount — the previous implementation could
// strand a locked page on mobile when a nested overlay closed out of order.
import { computed, onBeforeUnmount, watch } from "vue";

const props = withDefaults(defineProps<{
  open?: boolean;
  title?: string;
  description?: string;
  dismissible?: boolean;
  maxWidth?: string;
  zIndex?: number;
  // Nuxt UI style-override object. `content` is honoured because call sites use
  // it to widen the panel (max-w-2xl / 3xl / 4xl); ignoring it made every modal
  // fall back to the default width.
  ui?: { content?: string };
}>(), { dismissible: true });

const emit = defineEmits<{ (e: "update:open", value: boolean): void }>();

// `ui.content` arrives as a class string like "max-w-4xl". A utility class alone
// would lose to this component's own scoped max-width, so the known width tokens
// are resolved to an inline value that reliably wins. The class is still applied
// for anything else the caller put in the string.
const CONTENT_WIDTHS: Record<string, string> = {
  "max-w-md": "28rem", "max-w-lg": "32rem", "max-w-xl": "36rem",
  "max-w-2xl": "42rem", "max-w-3xl": "48rem", "max-w-4xl": "56rem",
  "max-w-5xl": "64rem", "max-w-6xl": "72rem",
};
const panelStyle = computed(() => {
  if (props.maxWidth) return { maxWidth: props.maxWidth };
  for (const token of (props.ui?.content || "").split(/\s+/)) {
    if (CONTENT_WIDTHS[token]) return { maxWidth: CONTENT_WIDTHS[token] };
  }
  return undefined;
});

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
    <div class="u-modal" role="dialog" aria-modal="true" :aria-label="title || undefined" :style="props.zIndex != null ? { zIndex: props.zIndex } : undefined">
      <div class="u-modal__backdrop" @click="close" />
      <div class="u-modal__panel" :class="[props.ui?.content, $attrs.class]" :style="panelStyle">
        <!-- #content replaces the whole panel, matching Nuxt UI. -->
        <slot v-if="$slots.content" name="content" />
        <template v-else>
          <header v-if="$slots.title || title || dismissible" class="u-modal__header">
            <slot v-if="$slots.title" name="title" />
            <h2 v-else-if="title" class="u-modal__title">{{ title }}</h2>
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
  z-index: 5000;
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
  /* Centred: the 32px close button against a ~22px title line box left the
     title sitting above the button's centre. */
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
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
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font-size: 18px;
  /* Without line-height:1 the button's text box is taller than the glyph, so
     the icon sat above centre. */
  line-height: 1;
  cursor: pointer;
}
/* Flex already centres it; drop the inline-baseline nudge UIcon applies. */
.u-modal__close :deep(.u-icon) { vertical-align: 0; }
.u-modal__close:hover { background: rgba(255, 255, 255, 0.08); }

.u-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* Momentum scrolling inside the panel, and the scroll chain stops here so a
     flick at the end of the list does not scroll the page behind the modal. */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 20px;
}
.u-modal__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
}

/* Phones and narrow tablets: keep a clear gutter between the screen edge and
   the dialog rather than running it edge to edge, and leave room top and bottom
   (including the safe-area inset) so it never touches the screen edges. */
@media (max-width: 820px) {
  .u-modal {
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    align-items: center;
  }
  .u-modal__panel {
    max-width: none;
    max-height: calc(100dvh - 32px - env(safe-area-inset-bottom));
    border-radius: var(--radius, 10px);
  }
  .u-modal__header { padding: 14px 16px 12px; }
  .u-modal__body { padding: 16px; }
  /* Even two-column grid: four stretched flex items wrapped into ragged rows
     and consumed most of the dialog. */
  .u-modal__footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 16px;
  }
  .u-modal__footer > * { min-height: 40px; min-width: 0; justify-self: stretch; text-align: center; }
}

/* Very small screens still get a gutter, just a tighter one. */
@media (max-width: 400px) {
  .u-modal { padding: 10px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
  .u-modal__panel { max-height: calc(100dvh - 20px - env(safe-area-inset-bottom)); }
  .u-modal__footer { grid-template-columns: 1fr; }
}
</style>
