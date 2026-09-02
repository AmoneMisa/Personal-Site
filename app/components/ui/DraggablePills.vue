<script setup lang="ts">
export interface DraggablePillItem {
  key: string;
  label: string;
  className?: string;
  title?: string;
}

const props = withDefaults(defineProps<{
  items: DraggablePillItem[];
  visibleHintCount?: number;
  ariaLabel?: string;
}>(), {
  visibleHintCount: 3,
  ariaLabel: "",
});

function displayLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const chars = Array.from(trimmed);
  chars[0] = chars[0]!.toLocaleUpperCase();
  return chars.join("");
}

const hiddenCount = computed(() => Math.max(0, props.items.length - props.visibleHintCount));
const hiddenTitle = computed(() => props.items.slice(props.visibleHintCount).map((item) => displayLabel(item.label)).join(", "));

const rail = ref<HTMLElement | null>(null);
let pointerId: number | null = null;
let startX = 0;
let startScrollLeft = 0;

function startDrag(event: PointerEvent) {
  if (event.pointerType === "touch" || !rail.value) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  startScrollLeft = rail.value.scrollLeft;
  rail.value.setPointerCapture(event.pointerId);
  rail.value.classList.add("is-dragging");
}

function moveDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId || !rail.value) return;
  rail.value.scrollLeft = startScrollLeft - (event.clientX - startX);
}

function stopDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId || !rail.value) return;
  if (rail.value.hasPointerCapture(event.pointerId)) rail.value.releasePointerCapture(event.pointerId);
  rail.value.classList.remove("is-dragging");
  pointerId = null;
}
</script>

<template>
  <div v-if="items.length" class="draggable-pills" :aria-label="ariaLabel || undefined" @click.stop>
    <div
      ref="rail"
      class="draggable-pills__rail"
      @pointerdown.stop="startDrag"
      @pointermove.stop="moveDrag"
      @pointerup.stop="stopDrag"
      @pointercancel.stop="stopDrag"
    >
      <span
        v-for="item in items"
        :key="item.key"
        class="draggable-pills__pill"
        :class="item.className"
        :title="item.title"
      >{{ displayLabel(item.label) }}</span>
    </div>
    <span v-if="hiddenCount" class="draggable-pills__more" :title="hiddenTitle">+{{ hiddenCount }}</span>
  </div>
</template>

<style scoped>
.draggable-pills { min-width: 0; display: flex; align-items: center; gap: 6px; }
.draggable-pills__rail {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  touch-action: pan-x pan-y;
  cursor: grab;
  user-select: none;
}
.draggable-pills__rail::-webkit-scrollbar { display: none; }
.draggable-pills__rail.is-dragging { cursor: grabbing; }
.draggable-pills__pill,
.draggable-pills__more {
  flex: 0 0 auto;
  white-space: nowrap;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  line-height: 1.3;
  border: 1px solid var(--line);
  color: var(--ui-text-muted);
}
.draggable-pills__more {
  position: relative;
  z-index: 2;
  padding-inline: 7px;
  border-color: rgba(148,163,184,.25);
  background: var(--bg-panel);
}
</style>
