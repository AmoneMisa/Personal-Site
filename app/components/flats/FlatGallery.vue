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
const currentPhoto = computed(() => currentIndex.value == null ? null : props.photos[currentIndex.value] || null);
const position = computed(() => (currentIndex.value ?? 0) + 1);
const previewPhotos = computed(() => props.photos.slice(0, 5));
const hiddenPhotoCount = computed(() => Math.max(0, props.photos.length - previewPhotos.value.length));

function open(index: number) {
  if (!props.photos.length) return;
  currentIndex.value = Math.max(0, Math.min(index, props.photos.length - 1));
}

function close() {
  currentIndex.value = null;
}

function move(direction: -1 | 1) {
  if (!props.photos.length || currentIndex.value == null) return;
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

function onPointerDown(event: PointerEvent) {
  if (props.photos.length < 2) return;
  swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
}

function onPointerUp(event: PointerEvent) {
  if (!swipeStart || event.pointerId !== swipeStart.id) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
  move(dx < 0 ? 1 : -1);
}

function onPointerCancel() {
  swipeStart = null;
}

function onKeydown(event: KeyboardEvent) {
  if (currentIndex.value == null) return;
  if (event.key === "Escape") close();
  else if (event.key === "ArrowLeft") move(-1);
  else if (event.key === "ArrowRight") move(1);
  else return;
  event.preventDefault();
}

function updateZoom(event: MouseEvent) {
  const image = event.currentTarget as HTMLImageElement;
  const rect = image.getBoundingClientRect();
  image.style.setProperty("--zoom-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
  image.style.setProperty("--zoom-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
}

function resetZoom(event: MouseEvent) {
  const image = event.currentTarget as HTMLImageElement;
  image.style.setProperty("--zoom-x", "50%");
  image.style.setProperty("--zoom-y", "50%");
}

watch(currentIndex, (index) => {
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
      <div class="flat-lightbox__stage" @click.stop @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="onPointerCancel">
        <img :src="currentPhoto" :alt="`${title} (${position}/${photos.length})`" referrerpolicy="no-referrer" draggable="false" @error="handlePhotoError" @mousemove="updateZoom" @mouseleave="resetZoom">
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
.flat-lightbox__stage { width: min(82vw, 1200px); height: min(76dvh, 720px); display: flex; align-items: center; justify-content: center; cursor: default; pointer-events: auto; touch-action: pan-y pinch-zoom; user-select: none; -webkit-user-select: none; }
.flat-lightbox__stage img { -webkit-user-drag: none; display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; transform-origin: var(--zoom-x, 50%) var(--zoom-y, 50%); transition: transform 180ms ease; }
@media (hover: hover) and (pointer: fine) { .flat-lightbox__stage img { cursor: zoom-in; } .flat-lightbox__stage img:hover { transform: scale(1.7); cursor: zoom-out; } }
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
  .flat-lightbox__nav { width: 42px; height: 56px; font-size: 22px; }
  .flat-lightbox__nav_left { left: 8px; }
  .flat-lightbox__nav_right { right: 8px; }
  .flat-lightbox__close { top: 10px; right: 10px; }
}
</style>
