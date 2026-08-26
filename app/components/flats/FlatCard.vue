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

const { locale } = useI18n();
const isEnglish = computed(() => String(locale.value).startsWith("en"));
const aiVisionTitle = computed(() => isEnglish.value
  ? "Data from AI Vision"
  : "Данные из AI-Vision");
const goodPriceLabel = computed(() => isEnglish.value ? "Good price" : "Хорошая цена");
const showOnMapLabel = computed(() => isEnglish.value ? "Show on map" : "Показать на карте");
const canShowOnMap = computed(() => {
  if (props.listing.lat == null || props.listing.lng == null) return false;
  const lat = Number(props.listing.lat);
  const lng = Number(props.listing.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
});
const goodPriceTitle = computed(() => {
  const median = props.presentation.goodPriceMedianUsd;
  const count = props.presentation.goodPriceComparableCount;
  if (median == null) return goodPriceLabel.value;
  return isEnglish.value
    ? `Below the median for ${count} comparable listings (≈ ${median.toLocaleString()} USD)`
    : `Ниже медианы для ${count} похожих объявлений (≈ ${median.toLocaleString()} USD)`;
});
const visionLabels = computed(() => new Set(props.presentation.visionBadgeLabels || []));

type PriceTone = "green" | "blue" | "pink" | "orange" | "yellow" | "red";

function displayedUsdPrice(): number | null {
  if (props.listing.price != null && String(props.listing.currency || "").toUpperCase() === "USD") {
    return props.listing.price;
  }
  const label = props.presentation.convertedPrice || "";
  if (!/\bUSD\b/i.test(label)) return null;
  const numeric = label.replace(/[^\d]/g, "");
  return numeric ? Number(numeric) : null;
}

const priceTone = computed<PriceTone | null>(() => {
  const median = props.presentation.goodPriceMedianUsd;
  const priceUsd = displayedUsdPrice();
  if (median == null || median <= 0 || priceUsd == null || priceUsd <= 0) return null;
  const ratio = priceUsd / median;
  if (ratio >= 1.45) return "red";
  if (ratio >= 1.31) return "yellow";
  if (ratio >= 1.16) return "orange";
  if (ratio >= 0.85) return "pink";
  if (ratio >= 0.70) return "blue";
  return "green";
});

function suspiciousRoomShare(listing: FlatListing): boolean {
  if (listing.potentiallyUnsafe === true) return true;
  const text = `${listing.title || ""}\n${listing.description || ""}`;
  const roomOnly = listing.roomOnly === true || /(?:подселени|койко[-\s]?мест|место\s+в\s+(?:комнат|квартир)|одно\s+место|1\s+место|bed\s*space|roommate|flatmate|sherik(?:ka|lik)|шерик(?:ка|лик)|(?:bitta|1)\s+joy\s+(?:bor|mavjud)|(?:битта|1)\s+жой\s+(?:бор|мавжуд)|birga\s+yashash(?:ga)?[^\r\n.!?]{0,36}(?:\d+\s*ta?\s*)?(?:qiz|ayol)[^\r\n.!?]{0,20}(?:kerak|kere)|kvartira(?:ga|da)?[^\r\n.!?]{0,36}(?:1|bitta)\s*(?:ta\s*)?(?:qiz|ayol)[^\r\n.!?]{0,20}(?:ijarachi\s*)?(?:kerak|kere))/iu.test(text);
  if (!roomOnly) return false;
  const oneWoman = /(?:только|нужн[а-яё]*|ищ[еу][а-яё]*|подсел[а-яё]*)[^\r\n.!?]{0,24}(?:одн(?:а|ой|у)|1)\s+(?:девушк[а-яё]*|женщин[а-яё]*)|(?:faqat\s+)?(?:1|bitta)\s*(?:ta\s*)?(?:qiz|ayol)[^\r\n.!?]{0,18}(?:ijarachi\s*)?(?:kerak|kere|uchun)?/iu.test(text);
  if (!oneWoman) return false;
  const thresholds: Record<string, number> = { USD: 120, EUR: 110, UZS: 1_500_000, KZT: 55_000, UAH: 4_500, RON: 500 };
  const limit = thresholds[String(listing.currency || "").toUpperCase()];
  const price = Number(listing.price);
  return limit != null && Number.isFinite(price) && price > 0 && price <= limit;
}

const unsafeListing = computed(() => suspiciousRoomShare(props.listing));
const unsafeLabel = computed(() => isEnglish.value ? "Potentially unsafe" : "Потенциально опасное");
const unsafeTitle = computed(() => isEnglish.value
  ? "Unusually low-price room share seeking one woman. Verify the landlord and terms before meeting or paying."
  : "Подселение по необычно низкой цене с поиском одной женщины. Проверьте арендодателя и условия до встречи или оплаты.");

const pillItems = computed<DraggablePillItem[]>(() => {
  const items: DraggablePillItem[] = props.presentation.badges.map((badge, index) => ({
    key: `${badge}:${index}`,
    label: badge,
    className: visionLabels.value.has(badge) ? "flat-card__badge flat-card__badge_vision" : "flat-card__badge",
    title: visionLabels.value.has(badge) ? aiVisionTitle.value : undefined,
  }));
  if (unsafeListing.value) {
    items.unshift({
      key: "potentially-unsafe",
      label: unsafeLabel.value,
      className: "flat-card__badge flat-card__badge_warning",
      title: unsafeTitle.value,
    });
  }
  return items;
});

function showOnMap() {
  if (!canShowOnMap.value || !import.meta.client) return;
  window.dispatchEvent(new CustomEvent("flat-map-focus", {
    detail: {
      id: props.listing.id,
      source: props.listing.source,
      country: props.listing.country,
      lat: Number(props.listing.lat),
      lng: Number(props.listing.lng),
    },
  }));
}

const emit = defineEmits<{
  open: [];
  toggleFavorite: [];
  toggleHidden: [];
  photoError: [event: Event];
}>();
</script>

<template>
  <article class="flat-card" :class="{ 'flat-card_favorite': favorite, 'flat-card_hidden': hidden, 'flat-card_checking': checking, 'flat-card_warning': unsafeListing }" :aria-busy="checking" @click="emit('open')">
    <div class="flat-card__photo">
      <img v-if="photo" :src="photo" :alt="presentation.title" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="emit('photoError', $event)">
      <div v-else class="flat-card__no-photo"><u-icon name="i-lucide-image-off" class="flat-card__no-photo-icon" aria-hidden="true" /><span>{{ noPhotoLabel }}</span></div>
      <span v-if="presentation.dealLabel" class="flat-card__deal" :class="`flat-card__deal_${presentation.dealTone}`">{{ presentation.dealLabel }}</span>
      <span v-if="presentation.goodPrice" class="flat-card__good-price" :title="goodPriceTitle"><u-icon name="i-lucide-trending-down" />{{ goodPriceLabel }}</span>
      <div class="flat-card__actions">
        <button v-if="canShowOnMap" type="button" class="flat-card__action" :aria-label="showOnMapLabel" :title="showOnMapLabel" @click.stop="showOnMap"><u-icon name="i-lucide-map-pinned" /></button>
        <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': favorite }" :aria-label="favoriteLabel" @click.stop="emit('toggleFavorite')"><u-icon name="i-lucide-heart" /></button>
        <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': hidden }" :aria-label="hideLabel" @click.stop="emit('toggleHidden')"><u-icon :name="hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'" /></button>
      </div>
    </div>
    <div class="flat-card__body">
      <div class="flat-card__price-row">
        <div class="flat-card__price" :class="priceTone ? `flat-card__price_${priceTone}` : undefined">{{ presentation.price }}</div>
        <div v-if="presentation.convertedPrice" class="flat-card__price-conv text-muted">{{ presentation.convertedPrice }}</div>
      </div>
      <h3 class="flat-card__title" :title="presentation.title">{{ presentation.title }}</h3>
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
.flat-card { position: relative; min-width: 0; height: 100%; align-self: stretch; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg-panel); cursor: pointer; transition: transform 140ms ease, border-color 180ms ease, box-shadow 180ms ease; display: flex; flex-direction: column; }
.flat-card:hover { transform: translateY(-2px); border-color: rgba(224,103,154,0.4); box-shadow: 0 12px 30px rgba(0,0,0,.16); }
.flat-card_warning { border-color: rgba(242,184,107,.56); box-shadow: inset 0 0 0 1px rgba(242,184,107,.08); }
.flat-card_checking { pointer-events: none; }
.flat-card__checking { position: absolute; z-index: 5; inset: 0; display: grid; place-content: center; justify-items: center; gap: 9px; padding: 18px; background: rgba(7,12,34,.92); color: var(--text-primary); font-size: 12.5px; font-weight: 700; text-align: center; }
.flat-card__checking-icon { width: 26px; height: 26px; color: var(--accent-pink); animation: flat-card-spin .8s linear infinite; }
@keyframes flat-card-spin { to { transform: rotate(360deg); } }
.flat-card__photo { position: relative; width: 100%; aspect-ratio: 1.5; flex: 0 0 auto; overflow: hidden; background: var(--bg-panel); }
.flat-card__photo::before { content: ""; position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; height: 64%; pointer-events: none; background: linear-gradient(180deg, rgba(11,16,42,0) 0%, rgba(11,16,42,.08) 24%, rgba(11,16,42,.38) 52%, rgba(11,16,42,.78) 78%, var(--bg-panel) 100%); }
.flat-card__photo::after { content: ""; position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; height: 40%; pointer-events: none; background: linear-gradient(180deg, rgba(11,16,42,0) 0%, rgba(11,16,42,.14) 34%, rgba(11,16,42,.55) 74%, var(--bg-panel) 100%); }
.flat-card__photo > img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 260ms ease; }
.flat-card:hover .flat-card__photo > img { transform: scale(1.015); }
.flat-card__no-photo { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; height: 100%; color: var(--text-muted); font-size: 12px; background: var(--bg-panel-2); }
.flat-card__no-photo-icon { width: 34px; height: 34px; opacity: 0.48; }
.flat-card__deal { position: absolute; z-index: 2; top: 9px; left: 9px; max-width: calc(100% - 124px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; line-height: 1; padding: 6px 9px; border: 1px solid rgba(224,103,154,.42); border-radius: 7px; background: #0d1128; color: var(--accent-pink); box-shadow: 0 3px 12px rgba(0,0,0,.2); }
.flat-card__deal_sale { color: #f58ab5; border-color: rgba(245,138,181,.45); }.flat-card__deal_rent { color: #b79cff; border-color: rgba(183,156,255,.42); }.flat-card__deal_room { color: #77d9e8; border-color: rgba(119,217,232,.42); }.flat-card__deal_short { color: #f4c86a; border-color: rgba(244,200,106,.45); }
.flat-card__good-price { position: absolute; z-index: 3; left: 9px; bottom: 9px; display: inline-flex; align-items: center; gap: 4px; max-width: calc(100% - 18px); padding: 5px 8px; border: 1px solid rgba(74,222,128,.42); border-radius: 999px; background: rgba(8,31,28,.86); color: #86efac; font-size: 10.5px; font-weight: 700; line-height: 1; box-shadow: 0 3px 12px rgba(0,0,0,.2); }
.flat-card__good-price :deep(svg) { width: 12px; height: 12px; }
.flat-card__actions { position: absolute; z-index: 3; top: 8px; right: 8px; display: flex; gap: 5px; }
.flat-card__action { width: 32px; height: 32px; display: inline-grid; place-items: center; padding: 0; border: 1px solid rgba(66,73,116,.86); border-radius: 7px; background: #0d1128; color: #c8cbdb; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.18); transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease; }
.flat-card__action:hover, .flat-card__action_active { color: var(--accent-pink); border-color: rgba(224,103,154,.58); background: rgba(26,29,57,.94); }
.flat-card__body { position: relative; z-index: 2; min-height: 0; flex: 1 1 auto; margin-top: -1px; padding: 11px 13px 12px; display: flex; flex-direction: column; gap: 4px; background: var(--bg-panel); }
.flat-card__price-row { min-width: 0; min-height: 22px; display: flex; align-items: baseline; gap: 8px; white-space: nowrap; overflow: hidden; }
.flat-card__price { min-width: 0; font-weight: 750; font-size: 18px; line-height: 1.2; color: var(--text-white, inherit); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; }
.flat-card__price_green { color: #4ade80; }.flat-card__price_blue { color: #67e8f9; }.flat-card__price_pink { color: #e0679a; }.flat-card__price_orange { color: #fb923c; }.flat-card__price_yellow { color: #facc15; }.flat-card__price_red { color: #ef4444; }
.flat-card__price-conv { flex: 0 1 auto; min-width: 0; font-size: 12px; font-weight: 500; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; }
.flat-card__title { min-height: 19px; margin-top: 2px; font-size: 14px; font-weight: 650; line-height: 1.36; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; white-space: normal; overflow-wrap: anywhere; }.flat-card__spec { min-height: 16px; font-size: 12px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.flat-card__badges { min-height: 27px; margin-top: 5px; }.flat-card__badges :deep(.flat-card__badge) { border-radius: 999px; padding: 4px 7px; font-size: 10.5px; font-weight: 600; line-height: 1.15; background: rgba(255,255,255,0.05); color: var(--text-primary); }.flat-card__badges :deep(.flat-card__badge_vision) { border-color: rgba(56,189,248,.36); color: #8bdcf7; background: rgba(56,189,248,.08); }.flat-card__badges :deep(.flat-card__badge_warning) { border-color: rgba(242,184,107,.52); color: #f2b86b; background: rgba(242,184,107,.1); }
.flat-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 6px 10px; margin-top: auto; padding-top: 8px; font-size: 11.5px; line-height: 1.35; }.flat-card__location { min-width: 0; display: inline-flex; align-items: center; gap: 5px; flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.flat-card__meta-tail { display: inline-flex; flex: 0 0 auto; gap: 5px; white-space: nowrap; margin-left: auto; }.flat-card__src { text-transform: capitalize; opacity: 0.72; }
.flat-card_favorite { border-color: rgba(224,103,154,0.52); }.flat-card_hidden { opacity: 0.64; border-style: dashed; }

@media (max-width: 760px) {
  .flat-card { display: grid; grid-template-columns: minmax(112px, 42%) minmax(0, 1fr); height: 148px; min-height: 148px; }
  .flat-card__photo { width: 100%; height: 148px; min-height: 0; aspect-ratio: auto; overflow: hidden; }
  .flat-card__photo::before { inset: 0 0 0 auto; width: 48%; height: auto; background: linear-gradient(90deg, rgba(11,16,42,0) 0%, rgba(11,16,42,.1) 24%, rgba(11,16,42,.42) 54%, rgba(11,16,42,.8) 80%, var(--bg-panel) 100%); }
  .flat-card__photo::after { inset: 0 0 0 auto; width: 36%; height: auto; background: linear-gradient(90deg, rgba(11,16,42,0) 0%, rgba(11,16,42,.16) 34%, rgba(11,16,42,.58) 72%, var(--bg-panel) 100%); }
  .flat-card__body { min-width: 0; margin-top: 0; padding: 7px 8px 7px 6px; gap: 1px; overflow: hidden; }
  .flat-card__price-row { min-height: 17px; gap: 5px; }
  .flat-card__price { font-size: 14px; }
  .flat-card__price-conv { font-size: 9.5px; }
  .flat-card__title { min-height: 15px; margin-top: 1px; font-size: 11.5px; line-height: 1.25; }
  .flat-card__spec { min-height: 12px; font-size: 9.5px; line-height: 1.25; }
  .flat-card__badges { min-height: 20px; margin-top: 2px; }
  .flat-card__badges :deep(.flat-card__badge) { padding: 3px 5px; font-size: 8.5px; }
  .flat-card__meta { gap: 3px; padding-top: 2px; font-size: 8.5px; }
  .flat-card__meta-tail { gap: 2px; }
  .flat-card__location { gap: 2px; }
  .flat-card__deal { top: 6px; left: 6px; max-width: calc(100% - 84px); padding: 4px 5px; font-size: 8.5px; }
  .flat-card__good-price { left: 6px; bottom: 6px; max-width: calc(100% - 12px); padding: 4px 6px; font-size: 8px; gap: 3px; }
  .flat-card__good-price :deep(svg) { width: 9px; height: 9px; }
  .flat-card__actions { top: 5px; right: 5px; gap: 3px; }
  .flat-card__action { width: 24px; height: 24px; border-radius: 6px; }
  .flat-card__no-photo { gap: 4px; padding: 6px; font-size: 9px; text-align: center; }
  .flat-card__no-photo-icon { width: 23px; height: 23px; }
}
</style>