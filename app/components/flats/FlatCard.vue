<script setup lang="ts">
import type { FlatCardPresentation, FlatListing } from "~/types/flats";
import type { DraggablePillItem } from "~/components/ui/DraggablePills.vue";

const props = defineProps<{
  listing: FlatListing;
  photo: string | null;
  presentation: FlatCardPresentation;
  favorite?: boolean;
  hidden?: boolean;
  checking?: boolean;
  noPhotoLabel: string;
  checkingLabel: string;
  favoriteLabel: string;
  hideLabel: string;
}>();

const pillItems = computed<DraggablePillItem[]>(() => props.presentation.badges.map((badge, index) => ({
  key: `${badge}:${index}`,
  label: badge,
  className: "flat-card__badge",
})));

const emit = defineEmits<{
  open: [];
  toggleFavorite: [];
  toggleHidden: [];
  photoError: [event: Event];
}>();
</script>

<template>
  <article class="flat-card" :class="{ 'flat-card_favorite': favorite, 'flat-card_hidden': hidden, 'flat-card_checking': checking }" :aria-busy="checking" @click="emit('open')">
    <div class="flat-card__photo">
      <img v-if="photo" :src="photo" :alt="presentation.title" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="emit('photoError', $event)">
      <div v-else class="flat-card__no-photo"><u-icon name="i-lucide-image-off" class="flat-card__no-photo-icon" aria-hidden="true" /><span>{{ noPhotoLabel }}</span></div>
      <span v-if="presentation.dealLabel" class="flat-card__deal" :class="`flat-card__deal_${presentation.dealTone}`">{{ presentation.dealLabel }}</span>
      <div class="flat-card__actions">
        <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': favorite }" :aria-label="favoriteLabel" @click.stop="emit('toggleFavorite')"><u-icon name="i-lucide-heart" /></button>
        <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': hidden }" :aria-label="hideLabel" @click.stop="emit('toggleHidden')"><u-icon :name="hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'" /></button>
      </div>
    </div>
    <div class="flat-card__body">
      <div class="flat-card__price">{{ presentation.price }}</div>
      <div v-if="presentation.convertedPrice" class="flat-card__price-conv text-muted">{{ presentation.convertedPrice }}</div>
      <h3 class="flat-card__title">{{ presentation.title }}</h3>
      <div v-if="presentation.specification" class="flat-card__spec text-muted">{{ presentation.specification }}</div>
      <UiDraggablePills v-if="pillItems.length" class="flat-card__badges" :items="pillItems" :visible-hint-count="3" />
      <div class="flat-card__meta text-muted">
        <span v-if="presentation.location" class="flat-card__location"><u-icon name="i-lucide-map-pin" />{{ presentation.location }}</span>
        <span class="flat-card__meta-tail"><span class="flat-card__src">{{ listing.source }}</span><span v-if="presentation.dateLabel">· {{ presentation.dateLabel }}</span></span>
      </div>
    </div>
    <div v-if="checking" class="flat-card__checking" role="status" aria-live="polite"><u-icon name="i-lucide-loader-circle" class="flat-card__checking-icon" /><span>{{ checkingLabel }}</span></div>
  </article>
</template>

<style scoped>
.flat-card { position: relative; min-width: 0; height: auto; align-self: start; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg-panel); cursor: pointer; transition: transform 140ms ease, border-color 180ms ease, box-shadow 180ms ease; display: flex; flex-direction: column; }
.flat-card:hover { transform: translateY(-2px); border-color: rgba(224,103,154,0.4); box-shadow: 0 12px 30px rgba(0,0,0,.16); }
.flat-card_checking { pointer-events: none; }
.flat-card__checking { position: absolute; z-index: 5; inset: 0; display: grid; place-content: center; justify-items: center; gap: 9px; padding: 18px; background: rgba(7,12,34,.92); color: var(--text-primary); font-size: 12.5px; font-weight: 700; text-align: center; }
.flat-card__checking-icon { width: 26px; height: 26px; color: var(--accent-pink); animation: flat-card-spin .8s linear infinite; }
@keyframes flat-card-spin { to { transform: rotate(360deg); } }
.flat-card__photo { position: relative; width: 100%; aspect-ratio: 16 / 9; flex: 0 0 auto; overflow: visible; background: var(--bg-panel); }
.flat-card__photo::after { content: ""; position: absolute; z-index: 1; left: 0; right: 0; bottom: -28px; height: 48%; pointer-events: none; background: linear-gradient(180deg, transparent 0%, rgba(11,16,42,.38) 42%, var(--bg-panel) 92%); }
.flat-card__photo > img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 260ms ease; }
.flat-card:hover .flat-card__photo > img { transform: scale(1.015); }
.flat-card__no-photo { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; height: 100%; color: var(--text-muted); font-size: 12px; background: var(--bg-panel-2); }
.flat-card__no-photo-icon { width: 34px; height: 34px; opacity: 0.48; }
.flat-card__deal { position: absolute; z-index: 2; top: 9px; left: 9px; max-width: calc(100% - 92px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; line-height: 1; padding: 6px 9px; border: 1px solid rgba(224,103,154,.42); border-radius: 7px; background: #0d1128; color: var(--accent-pink); box-shadow: 0 3px 12px rgba(0,0,0,.2); }
.flat-card__deal_sale { color: #f58ab5; border-color: rgba(245,138,181,.45); }.flat-card__deal_rent { color: #b79cff; border-color: rgba(183,156,255,.42); }.flat-card__deal_room { color: #77d9e8; border-color: rgba(119,217,232,.42); }.flat-card__deal_short { color: #f4c86a; border-color: rgba(244,200,106,.45); }
.flat-card__actions { position: absolute; z-index: 3; top: 8px; right: 8px; display: flex; gap: 5px; }
.flat-card__action { width: 32px; height: 32px; display: inline-grid; place-items: center; padding: 0; border: 1px solid rgba(66,73,116,.86); border-radius: 7px; background: #0d1128; color: #c8cbdb; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.18); transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease; }
.flat-card__action:hover, .flat-card__action_active { color: var(--accent-pink); border-color: rgba(224,103,154,.58); background: rgba(26,29,57,.94); }
.flat-card__body { position: relative; z-index: 2; min-height: 0; padding: 11px 13px 12px; display: flex; flex-direction: column; gap: 4px; }
.flat-card__price { font-weight: 750; font-size: 18px; line-height: 1.2; color: var(--text-white, inherit); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.flat-card__price-conv { font-size: 12px; font-weight: 500; line-height: 1.35; }.flat-card__title { margin-top: 2px; font-size: 14px; font-weight: 650; line-height: 1.36; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }.flat-card__spec { font-size: 12px; line-height: 1.35; }
.flat-card__badges { margin-top: 5px; }.flat-card__badges :deep(.flat-card__badge) { border-radius: 999px; padding: 4px 7px; font-size: 10.5px; font-weight: 600; line-height: 1.15; background: rgba(255,255,255,0.05); color: var(--text-primary); }
.flat-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 6px 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.055); font-size: 11.5px; line-height: 1.35; }.flat-card__location { min-width: 0; display: inline-flex; align-items: center; gap: 5px; flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.flat-card__meta-tail { display: inline-flex; flex: 0 0 auto; gap: 5px; white-space: nowrap; margin-left: auto; }.flat-card__src { text-transform: capitalize; opacity: 0.72; }
.flat-card_favorite { border-color: rgba(224,103,154,0.52); }.flat-card_hidden { opacity: 0.64; border-style: dashed; }
</style>
