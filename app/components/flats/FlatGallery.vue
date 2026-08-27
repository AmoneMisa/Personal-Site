<script setup lang="ts">
const props = defineProps<{
  photos: string[];
  title: string;
  viewerLabel: string;
  previousLabel: string;
  nextLabel: string;
  closeLabel: string;
}>();

const emit = defineEmits<{
  photoError: [event: Event];
}>();

const lightboxOpen = defineModel<boolean>("lightboxOpen", { default: false });
const currentIndex = ref<number | null>(null);
const zoom = ref(1);
const stageElement = ref<HTMLDivElement | null>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const pan = reactive({ x: 0, y: 0 });
const dragging = ref(false);
const currentPhoto = computed(() => currentIndex.value == null ? null : props.photos[currentIndex.value] || null);
const position = computed(() => (currentIndex.value ?? 0) + 1);
const previewPhotos = computed(() => props.photos.slice(0, 5));
const hiddenPhotoCount = computed(() => Math.max(0, props.photos.length - previewPhotos.value.length));

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function resetZoom() {
  zoom.value = MIN_ZOOM;
  pan.x = 0;
  pan.y = 0;
}

function setZoom(value: number) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
  if (zoom.value === MIN_ZOOM) {
    pan.x = 0;
    pan.y = 0;
  } else {
    nextTick(clampPan);
  }
}

function changeZoom(delta: number) {
  setZoom(zoom.value + delta);
}

function open(index: number) {
  if (!props.photos.length) return;
  resetZoom();
  currentIndex.value = Math.max(0, Math.min(index, props.photos.length - 1));
}

function close() {
  resetZoom();
  currentIndex.value = null;
}

function move(direction: -1 | 1) {
  if (!props.photos.length || currentIndex.value == null) return;
  resetZoom();
  currentIndex.value = (currentIndex.value + direction + props.photos.length) % props.photos.length;
}

function handlePhotoError(event: Event) {
  emit("photoError", event);
  nextTick(() => {
    if (!props.photos.length) close();
    else if (currentIndex.value != null) currentIndex.value = Math.min(currentIndex.value, props.photos.length - 1);
  });
}

const SWIPE_MIN_PX = 50;
let swipeStart: { x: number; y: number; id: number } | null = null;
let panStart: { x: number; y: number; panX: number; panY: number; id: number } | null = null;
let suppressZoomClick = false;

function panBounds() {
  const stage = stageElement.value;
  const image = imageElement.value;
  if (!stage || !image || zoom.value <= MIN_ZOOM) return { x: 0, y: 0 };
  return {
    x: Math.max(0, (image.clientWidth * zoom.value - stage.clientWidth) / 2),
    y: Math.max(0, (image.clientHeight * zoom.value - stage.clientHeight) / 2),
  };
}

function clampPan() {
  const bounds = panBounds();
  pan.x = Math.max(-bounds.x, Math.min(bounds.x, pan.x));
  pan.y = Math.max(-bounds.y, Math.min(bounds.y, pan.y));
}

function onPointerDown(event: PointerEvent) {
  if (zoom.value > MIN_ZOOM) {
    event.preventDefault();
    panStart = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, id: event.pointerId };
    dragging.value = true;
    suppressZoomClick = false;
    stageElement.value?.setPointerCapture(event.pointerId);
    return;
  }
  if (props.photos.length < 2) return;
  swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
}

function onPointerMove(event: PointerEvent) {
  if (!panStart || event.pointerId !== panStart.id) return;
  const dx = event.clientX - panStart.x;
  const dy = event.clientY - panStart.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressZoomClick = true;
  pan.x = panStart.panX + dx;
  pan.y = panStart.panY + dy;
  clampPan();
}

function onPointerUp(event: PointerEvent) {
  if (panStart && event.pointerId === panStart.id) {
    panStart = null;
    dragging.value = false;
    if (stageElement.value?.hasPointerCapture(event.pointerId)) stageElement.value.releasePointerCapture(event.pointerId);
    return;
  }
  if (!swipeStart || event.pointerId !== swipeStart.id) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
  move(dx < 0 ? 1 : -1);
}

function onPointerCancel() {
  swipeStart = null;
  panStart = null;
  dragging.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (currentIndex.value == null) return;
  if (event.key === "Escape") close();
  else if (event.key === "ArrowLeft") move(-1);
  else if (event.key === "ArrowRight") move(1);
  else if (event.key === "+" || event.key === "=") changeZoom(ZOOM_STEP);
  else if (event.key === "-") changeZoom(-ZOOM_STEP);
  else if (event.key === "0") resetZoom();
  else return;
  event.preventDefault();
}

function toggleZoom(event: MouseEvent) {
  if (suppressZoomClick) {
    suppressZoomClick = false;
    return;
  }
  if (zoom.value > MIN_ZOOM) {
    resetZoom();
    return;
  }

  const image = imageElement.value;
  if (!image) return;
  const rect = image.getBoundingClientRect();
  setZoom(1.75);
  nextTick(() => {
    pan.x = -(event.clientX - (rect.left + rect.width / 2)) * (zoom.value - 1);
    pan.y = -(event.clientY - (rect.top + rect.height / 2)) * (zoom.value - 1);
    clampPan();
  });
}

function onWheel(event: WheelEvent) {
  changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
}

watch(currentIndex, (index) => {
  resetZoom();
  lightboxOpen.value = index !== null;
});
watch(lightboxOpen, (open) => {
  if (!open) close();
});
watch(() => props.photos.length, (length) => {
  if (!length) close();
  else if (currentIndex.value != null) currentIndex.value = Math.min(currentIndex.value, length - 1);
});

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="photos.length" class="flat-gallery" :class="`flat-gallery_count-${Math.min(previewPhotos.length, 5)}`">
    <button
      v-for="(photo, index) in previewPhotos"
      :key="photo"
      type="button"
      class="flat-gallery__item"
      :class="{ 'flat-gallery__item_main': index === 0 }"
      :aria-label="`${viewerLabel}: ${index + 1} / ${photos.length}`"
      @click="open(index)"
    >
      <img
        :src="photo"
        :alt="`${title} (${index + 1})`"
        class="flat-gallery__thumbnail"
        :loading="index === 0 ? 'eager' : 'lazy'"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="handlePhotoError"
      >
      <span v-if="index === 0 && photos.length > 1" class="flat-gallery__counter">1 / {{ photos.length }}</span>
      <span v-if="index === previewPhotos.length - 1 && hiddenPhotoCount > 0" class="flat-gallery__more">+{{ hiddenPhotoCount }} фото</span>
    </button>
  </div>

  <teleport to="body">
    <div v-if="currentPhoto" class="flat-lightbox" role="dialog" aria-modal="true" :aria-label="viewerLabel" @click="close">
      <div ref="stageElement" class="flat-lightbox__stage" :class="{ 'flat-lightbox__stage_pannable': zoom > MIN_ZOOM, 'flat-lightbox__stage_dragging': dragging }" @click.stop @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerCancel" @wheel.prevent.stop="onWheel">
        <img
          ref="imageElement"
          :src="currentPhoto"
          :alt="`${title} (${position}/${photos.length})`"
          referrerpolicy="no-referrer"
          draggable="false"
          :class="{ 'flat-lightbox__image_zoomed': zoom > MIN_ZOOM }"
          :style="{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }"
          @error="handlePhotoError"
          @click.stop="toggleZoom"
        >
      </div>
      <div class="flat-lightbox__zoom" @click.stop>
        <button type="button" :disabled="zoom <= MIN_ZOOM" aria-label="Zoom out" @click="changeZoom(-ZOOM_STEP)">−</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button type="button" :disabled="zoom >= MAX_ZOOM" aria-label="Zoom in" @click="changeZoom(ZOOM_STEP)">+</button>
        <button type="button" :disabled="zoom === MIN_ZOOM" aria-label="Reset zoom" @click="resetZoom">1:1</button>
      </div>
      <button v-if="photos.length > 1" type="button" class="flat-lightbox__nav flat-lightbox__nav_left" :aria-label="previousLabel" @click.stop="move(-1)"><u-icon name="i-lucide-chevron-left" /></button>
      <button v-if="photos.length > 1" type="button" class="flat-lightbox__nav flat-lightbox__nav_right" :aria-label="nextLabel" @click.stop="move(1)"><u-icon name="i-lucide-chevron-right" /></button>
      <span v-if="photos.length > 1" class="flat-lightbox__counter">{{ position }} / {{ photos.length }}</span>
      <button type="button" class="flat-lightbox__close" :aria-label="closeLabel" @click.stop="close"><u-icon name="i-lucide-x" /></button>
    </div>
  </teleport>
</template>

<style scoped>
.flat-gallery {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) repeat(2, minmax(0, .72fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 6px;
  height: clamp(230px, 34vh, 300px);
  overflow: hidden;
  border-radius: 9px;
}
.flat-gallery__item {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: var(--bg-panel-2, #171c3a);
  cursor: zoom-in;
}
.flat-gallery__item_main { grid-row: 1 / -1; }
.flat-gallery__thumbnail {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid var(--line);
  border-radius: inherit;
  transition: border-color 140ms ease, transform 180ms ease;
}
.flat-gallery__item:hover .flat-gallery__thumbnail,
.flat-gallery__item:focus-visible .flat-gallery__thumbnail { border-color: var(--accent-pink); }
.flat-gallery__item:hover .flat-gallery__thumbnail { transform: scale(1.015); }
.flat-gallery__item:focus-visible { outline: 2px solid var(--accent-pink); outline-offset: -2px; }
.flat-gallery__counter,
.flat-gallery__more {
  position: absolute;
  z-index: 1;
  right: 8px;
  bottom: 8px;
  padding: 4px 7px;
  border-radius: 6px;
  background: rgba(8, 11, 26, .78);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  backdrop-filter: blur(5px);
}
.flat-gallery__more { inset: 0; display: grid; place-items: center; border-radius: inherit; background: rgba(8, 11, 26, .52); font-size: 14px; }
.flat-gallery_count-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
.flat-gallery_count-2 { grid-template-columns: 1.65fr .72fr; grid-template-rows: 1fr; }
.flat-gallery_count-2 .flat-gallery__item_main { grid-row: auto; }
.flat-gallery_count-3 { grid-template-columns: 1.65fr .72fr; }
.flat-gallery_count-4 { grid-template-columns: 1.65fr repeat(2, .72fr); }
.flat-gallery_count-4 .flat-gallery__item:nth-child(4) { grid-column: 2 / -1; }

.flat-lightbox { position: fixed; inset: 0; z-index: 5000; display: grid; place-items: center; isolation: isolate; background: #080b1a; padding: clamp(12px, 2vw, 28px); cursor: zoom-out; pointer-events: auto; }
.flat-lightbox__stage { width: min(82vw, 1200px); height: min(76dvh, 720px); display: flex; align-items: center; justify-content: center; cursor: default; pointer-events: auto; touch-action: pan-y pinch-zoom; user-select: none; -webkit-user-select: none; overflow: hidden; }
.flat-lightbox__stage_pannable { touch-action: none; cursor: grab; }
.flat-lightbox__stage_dragging { cursor: grabbing; }
.flat-lightbox__stage img { -webkit-user-drag: none; display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; transform-origin: center; transition: transform 120ms ease; cursor: zoom-in; }
.flat-lightbox__stage img.flat-lightbox__image_zoomed { cursor: grab; }
.flat-lightbox__stage_dragging img.flat-lightbox__image_zoomed { cursor: grabbing; transition: none; }
.flat-lightbox__zoom { position: fixed; z-index: 2; left: 50%; top: 16px; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px; padding: 5px; border: 1px solid #343a62; border-radius: 8px; background: #131730; color: #fff; }
.flat-lightbox__zoom button { min-width: 34px; height: 32px; padding: 0 8px; border: 0; border-radius: 6px; background: rgba(255,255,255,.05); color: inherit; font-weight: 700; cursor: pointer; }
.flat-lightbox__zoom button:hover:not(:disabled), .flat-lightbox__zoom button:focus-visible { color: var(--accent-pink); background: rgba(224,103,154,.12); }
.flat-lightbox__zoom button:disabled { opacity: .35; cursor: default; }
.flat-lightbox__zoom span { min-width: 48px; text-align: center; font: 600 12px/1.2 "JetBrains Mono", monospace; }
.flat-lightbox__nav, .flat-lightbox__close { position: fixed; z-index: 1; display: grid; place-items: center; border: 1px solid #343a62; border-radius: 8px; background: #131730; color: #fff; cursor: pointer; pointer-events: auto; }
.flat-lightbox__nav { top: 50%; width: 52px; height: 72px; transform: translateY(-50%); font-size: 28px; }
.flat-lightbox__nav:hover, .flat-lightbox__nav:focus-visible, .flat-lightbox__close:hover, .flat-lightbox__close:focus-visible { border-color: var(--accent-pink); color: var(--accent-pink); }
.flat-lightbox__nav_left { left: 16px; }
.flat-lightbox__nav_right { right: 16px; }
.flat-lightbox__close { top: 16px; right: 20px; width: 44px; height: 44px; font-size: 24px; }
.flat-lightbox__counter { position: fixed; bottom: 18px; left: 50%; z-index: 1; transform: translateX(-50%); padding: 6px 10px; border: 1px solid #343a62; border-radius: 6px; background: #131730; color: var(--text-primary); font: 500 12px/1.2 "JetBrains Mono", monospace; pointer-events: auto; }
@media (max-width: 760px) {
  .flat-gallery {
    height: clamp(220px, 42vh, 285px);
    grid-template-columns: minmax(0, 1.55fr) minmax(82px, .7fr);
    grid-template-rows: repeat(4, minmax(0, 1fr));
  }
  .flat-gallery__item_main { grid-row: 1 / -1; }
  .flat-gallery_count-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
  .flat-gallery_count-2 { grid-template-columns: 1.55fr .7fr; grid-template-rows: 1fr; }
  .flat-gallery_count-2 .flat-gallery__item_main { grid-row: auto; }
  .flat-gallery_count-3, .flat-gallery_count-4 { grid-template-columns: 1.55fr .7fr; }
  .flat-gallery_count-4 .flat-gallery__item:nth-child(4) { grid-column: auto; }
  .flat-lightbox__stage { width: 92vw; height: 76vh; }
  .flat-lightbox__zoom { top: 10px; }
  .flat-lightbox__nav { width: 42px; height: 56px; font-size: 22px; }
  .flat-lightbox__nav_left { left: 8px; }
  .flat-lightbox__nav_right { right: 8px; }
  .flat-lightbox__close { top: 10px; right: 10px; }
}
</style>
