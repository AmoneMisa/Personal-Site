import fs from 'node:fs'

const path = 'app/pages/flat-finder/index.vue'
let source = fs.readFileSync(path, 'utf8')
function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`Patch target not found: ${label}`)
  source = source.replace(before, after)
}

replaceOnce('filter refs',
`const agency = ref("any"); // any | owner | agency
const priceMin = ref<number | undefined>(undefined);
const priceMax = ref<number | undefined>(undefined);
const roomsMin = ref<number | undefined>(undefined);`,
`const agency = ref("any"); // any | owner | agency
const petFriendly = ref(false);
const roomOnlyFilter = ref(false);
const childrenRequired = ref(false);
const newBuildingOnly = ref(false);
const audience = ref("any");
const metro = ref("");
const priceMin = ref<number | undefined>(undefined);
const priceMax = ref<number | undefined>(undefined);
const roomsMin = ref<number | undefined>(undefined);
const roomsMax = ref<number | undefined>(undefined);
const bedroomsMin = ref<number | undefined>(undefined);
const bedroomsMax = ref<number | undefined>(undefined);
const areaMin = ref<number | undefined>(undefined);
const areaMax = ref<number | undefined>(undefined);
const floorMin = ref<number | undefined>(undefined);
const floorMax = ref<number | undefined>(undefined);
const totalFloorsMin = ref<number | undefined>(undefined);
const totalFloorsMax = ref<number | undefined>(undefined);
const yearMin = ref<number | undefined>(undefined);
const yearMax = ref<number | undefined>(undefined);
const maxAgeDays = ref<number | undefined>(undefined);`)

replaceOnce('scroll refs',
`const drawnArea = ref<Array<{ lat: number; lng: number }>>([]);
let loadSeq = 0;`,
`const drawnArea = ref<Array<{ lat: number; lng: number }>>([]);
const filtersEl = ref<HTMLElement | null>(null);
const showBackToTop = ref(false);
let loadSeq = 0;`)

replaceOnce('metro options',
`const districtOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  const set = new Set<string>();
  for (const c of picked) {
    for (const [cityName, loc] of Object.entries(c.locations ?? {})) {
      if (city.value && cityName !== city.value) continue;
      for (const d of loc?.districts ?? []) set.add(d);
    }
  }
  return [...set].sort();
});`,
`const districtOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  const set = new Set<string>();
  for (const c of picked) {
    for (const [cityName, loc] of Object.entries(c.locations ?? {})) {
      if (city.value && cityName !== city.value) continue;
      for (const d of loc?.districts ?? []) set.add(d);
    }
  }
  return [...set].sort();
});
const metroOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  const set = new Set<string>();
  for (const c of picked) {
    for (const [cityName, loc] of Object.entries(c.locations ?? {})) {
      if (city.value && cityName !== city.value) continue;
      for (const station of loc?.metro ?? []) set.add(station);
    }
  }
  return [...set].sort();
});`)

replaceOnce('select items',
`const districtItems = computed<Item[]>(() => [{ label: t("districtAny"), value: ANY }, ...districtOptions.value.map((d) => ({ label: d, value: d }))]);`,
`const districtItems = computed<Item[]>(() => [{ label: t("districtAny"), value: ANY }, ...districtOptions.value.map((d) => ({ label: d, value: d }))]);
const metroItems = computed<Item[]>(() => [{ label: filterLabel("metroAny"), value: ANY }, ...metroOptions.value.map((m) => ({ label: m, value: m }))]);`)

replaceOnce('select models',
`const districtSel = computed<string>({ get: () => district.value || ANY, set: (v) => (district.value = v === ANY ? "" : v) });`,
`const districtSel = computed<string>({ get: () => district.value || ANY, set: (v) => (district.value = v === ANY ? "" : v) });
const metroSel = computed<string>({ get: () => metro.value || ANY, set: (v) => (metro.value = v === ANY ? "" : v) });
const audienceItems = computed<Item[]>(() => [
  { label: filterLabel("audienceAny"), value: "any" },
  { label: filterLabel("audienceWomen"), value: "women" },
  { label: filterLabel("audienceMen"), value: "men" },
  { label: filterLabel("audienceFamily"), value: "family" },
]);
const audienceSel = computed<string>({ get: () => audience.value, set: (v) => (audience.value = v) });`)

replaceOnce('labels helper',
`const agencyItems = computed<Item[]>(() => [
  { label: t("agAny"), value: "any" }, { label: t("agOwner"), value: "owner" }, { label: t("agAgency"), value: "agency" },
]);`,
`const agencyItems = computed<Item[]>(() => [
  { label: t("agAny"), value: "any" }, { label: t("agOwner"), value: "owner" }, { label: t("agAgency"), value: "agency" },
]);
const FILTER_LABELS = {
  ru: { pets: "Pet-friendly", roomOnly: "Комната / подселение", children: "Можно с детьми", newBuilding: "Новостройка ≤ 5 лет", roomsMax: "Комнат до", bedroomsMin: "Спален от", bedroomsMax: "Спален до", areaMin: "Площадь от, м²", areaMax: "Площадь до, м²", floorMin: "Этаж от", floorMax: "Этаж до", totalFloorsMin: "Этажей в доме от", totalFloorsMax: "Этажей в доме до", yearMin: "Год постройки от", yearMax: "Год постройки до", metro: "Метро", metroAny: "Любое метро", audience: "Для кого", audienceAny: "Для всех", audienceWomen: "Женщины", audienceMen: "Мужчины", audienceFamily: "Семья", freshDays: "Опубликовано за, дней", backToTop: "Наверх к фильтрам" },
  en: { pets: "Pet-friendly", roomOnly: "Room / shared housing", children: "Children allowed", newBuilding: "New building ≤ 5 years", roomsMax: "Rooms max", bedroomsMin: "Bedrooms min", bedroomsMax: "Bedrooms max", areaMin: "Area min, m²", areaMax: "Area max, m²", floorMin: "Floor min", floorMax: "Floor max", totalFloorsMin: "Building floors min", totalFloorsMax: "Building floors max", yearMin: "Built from", yearMax: "Built to", metro: "Metro", metroAny: "Any metro", audience: "Tenant type", audienceAny: "Any", audienceWomen: "Women", audienceMen: "Men", audienceFamily: "Family", freshDays: "Posted within, days", backToTop: "Back to filters" },
} as const;
function filterLabel(key: keyof typeof FILTER_LABELS.en): string {
  const lang = locale.value.startsWith("ru") ? "ru" : "en";
  return FILTER_LABELS[lang][key];
}`)

replaceOnce('query serialization',
`  if (city.value) queryParams.city = city.value;
  if (propertyType.value !== "any") queryParams.propertyType = propertyType.value;
  if (dealType.value !== "any") queryParams.dealType = dealType.value;
  if (agency.value !== "any") queryParams.agency = agency.value;
  if (priceMin.value != null) queryParams.priceMin = String(priceMin.value);
  if (priceMax.value != null) queryParams.priceMax = String(priceMax.value);
  if (displayCurrency.value !== "USD") queryParams.currency = displayCurrency.value;
  if (roomsMin.value != null) queryParams.roomsMin = String(roomsMin.value);`,
`  if (city.value) queryParams.city = city.value;
  if (district.value) queryParams.district = district.value;
  if (metro.value) queryParams.metro = metro.value;
  if (propertyType.value !== "any") queryParams.propertyType = propertyType.value;
  if (dealType.value !== "any") queryParams.dealType = dealType.value;
  if (agency.value !== "any") queryParams.agency = agency.value;
  if (audience.value !== "any") queryParams.audience = audience.value;
  if (petFriendly.value) queryParams.pets = "1";
  if (roomOnlyFilter.value) queryParams.roomOnly = "1";
  if (childrenRequired.value) queryParams.children = "1";
  if (newBuildingOnly.value) queryParams.newBuilding = "1";
  if (priceMin.value != null) queryParams.priceMin = String(priceMin.value);
  if (priceMax.value != null) queryParams.priceMax = String(priceMax.value);
  if (displayCurrency.value !== "USD") queryParams.currency = displayCurrency.value;
  if (roomsMin.value != null) queryParams.roomsMin = String(roomsMin.value);
  if (roomsMax.value != null) queryParams.roomsMax = String(roomsMax.value);
  if (bedroomsMin.value != null) queryParams.bedroomsMin = String(bedroomsMin.value);
  if (bedroomsMax.value != null) queryParams.bedroomsMax = String(bedroomsMax.value);
  if (areaMin.value != null) queryParams.areaMin = String(areaMin.value);
  if (areaMax.value != null) queryParams.areaMax = String(areaMax.value);
  if (floorMin.value != null) queryParams.floorMin = String(floorMin.value);
  if (floorMax.value != null) queryParams.floorMax = String(floorMax.value);
  if (totalFloorsMin.value != null) queryParams.totalFloorsMin = String(totalFloorsMin.value);
  if (totalFloorsMax.value != null) queryParams.totalFloorsMax = String(totalFloorsMax.value);
  if (yearMin.value != null) queryParams.yearMin = String(yearMin.value);
  if (yearMax.value != null) queryParams.yearMax = String(yearMax.value);
  if (maxAgeDays.value != null) queryParams.maxAgeDays = String(maxAgeDays.value);`)

replaceOnce('query restore',
`  agency.value = ["owner", "agency"].includes(queryString(params.agency)) ? queryString(params.agency) : "any";
  priceMin.value = Number(queryString(params.priceMin)) || undefined;
  priceMax.value = Number(queryString(params.priceMax)) || undefined;
  if (queryString(params.currency)) displayCurrency.value = queryString(params.currency);
  roomsMin.value = Number(queryString(params.roomsMin)) || undefined;`,
`  agency.value = ["owner", "agency"].includes(queryString(params.agency)) ? queryString(params.agency) : "any";
  audience.value = ["women", "men", "family"].includes(queryString(params.audience)) ? queryString(params.audience) : "any";
  metro.value = queryString(params.metro);
  petFriendly.value = ["1", "true"].includes(queryString(params.pets).toLowerCase());
  roomOnlyFilter.value = ["1", "true"].includes(queryString(params.roomOnly).toLowerCase());
  childrenRequired.value = ["1", "true"].includes(queryString(params.children).toLowerCase());
  newBuildingOnly.value = ["1", "true"].includes(queryString(params.newBuilding).toLowerCase());
  priceMin.value = Number(queryString(params.priceMin)) || undefined;
  priceMax.value = Number(queryString(params.priceMax)) || undefined;
  if (queryString(params.currency)) displayCurrency.value = queryString(params.currency);
  roomsMin.value = Number(queryString(params.roomsMin)) || undefined;
  roomsMax.value = Number(queryString(params.roomsMax)) || undefined;
  bedroomsMin.value = Number(queryString(params.bedroomsMin)) || undefined;
  bedroomsMax.value = Number(queryString(params.bedroomsMax)) || undefined;
  areaMin.value = Number(queryString(params.areaMin)) || undefined;
  areaMax.value = Number(queryString(params.areaMax)) || undefined;
  floorMin.value = Number(queryString(params.floorMin)) || undefined;
  floorMax.value = Number(queryString(params.floorMax)) || undefined;
  totalFloorsMin.value = Number(queryString(params.totalFloorsMin)) || undefined;
  totalFloorsMax.value = Number(queryString(params.totalFloorsMax)) || undefined;
  yearMin.value = Number(queryString(params.yearMin)) || undefined;
  yearMax.value = Number(queryString(params.yearMax)) || undefined;
  maxAgeDays.value = Number(queryString(params.maxAgeDays)) || undefined;`)

replaceOnce('api params',
`  if (roomsMin.value != null) {
    params.roomsMin =
        String(roomsMin.value);
  }

  if (query.value.trim()) {`,
`  if (roomsMin.value != null) params.roomsMin = String(roomsMin.value);
  if (roomsMax.value != null) params.roomsMax = String(roomsMax.value);
  if (bedroomsMin.value != null) params.bedroomsMin = String(bedroomsMin.value);
  if (bedroomsMax.value != null) params.bedroomsMax = String(bedroomsMax.value);
  if (areaMin.value != null) params.areaMin = String(areaMin.value);
  if (areaMax.value != null) params.areaMax = String(areaMax.value);
  if (floorMin.value != null) params.floorMin = String(floorMin.value);
  if (floorMax.value != null) params.floorMax = String(floorMax.value);
  if (totalFloorsMin.value != null) params.totalFloorsMin = String(totalFloorsMin.value);
  if (totalFloorsMax.value != null) params.totalFloorsMax = String(totalFloorsMax.value);
  if (yearMin.value != null) params.yearMin = String(yearMin.value);
  if (yearMax.value != null) params.yearMax = String(yearMax.value);
  if (maxAgeDays.value != null) params.maxAgeDays = String(maxAgeDays.value);
  if (metro.value) params.metro = metro.value;
  if (audience.value !== "any") params.audience = audience.value;
  if (petFriendly.value) params.pets = "1";
  if (roomOnlyFilter.value) params.roomOnly = "1";
  if (childrenRequired.value) params.children = "1";
  if (newBuildingOnly.value) params.newBuilding = "1";

  if (query.value.trim()) {`)

replaceOnce('reset filters',
`function resetFilters() {
  city.value = ""; district.value = ""; propertyType.value = "any"; dealType.value = "any"; agency.value = "any";
  priceMin.value = undefined; priceMax.value = undefined; roomsMin.value = undefined; query.value = "";
  scheduleLoad(80);
}`,
`function resetFilters() {
  city.value = ""; district.value = ""; metro.value = ""; propertyType.value = "any"; dealType.value = "any"; agency.value = "any"; audience.value = "any";
  petFriendly.value = false; roomOnlyFilter.value = false; childrenRequired.value = false; newBuildingOnly.value = false;
  priceMin.value = undefined; priceMax.value = undefined; roomsMin.value = undefined; roomsMax.value = undefined;
  bedroomsMin.value = undefined; bedroomsMax.value = undefined; areaMin.value = undefined; areaMax.value = undefined;
  floorMin.value = undefined; floorMax.value = undefined; totalFloorsMin.value = undefined; totalFloorsMax.value = undefined;
  yearMin.value = undefined; yearMax.value = undefined; maxAgeDays.value = undefined; query.value = "";
  scheduleLoad(80);
}
function updateBackToTop() { showBackToTop.value = window.scrollY > 600; }
function scrollToFilters() { filtersEl.value?.scrollIntoView({ behavior: "smooth", block: "start" }); }`)

replaceOnce('watch geography',
`watch(city, () => {
      district.value = "";
    },
);

watch(countries, () => {
      district.value = "";
      city.value = "";
    },
);`,
`watch(city, () => {
      district.value = "";
      metro.value = "";
      query.value = "";
    },
);

watch(countries, () => {
      district.value = "";
      metro.value = "";
      city.value = "";
      query.value = "";
    },
);`)

replaceOnce('mounted scroll',
`  window.addEventListener(
      "keydown",
      onLightboxKeydown,
  );`,
`  window.addEventListener(
      "keydown",
      onLightboxKeydown,
  );
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();`)

replaceOnce('unmount scroll',
`  window.removeEventListener("keydown", onLightboxKeydown);`,
`  window.removeEventListener("keydown", onLightboxKeydown);
  window.removeEventListener("scroll", updateBackToTop);`)

replaceOnce('form ref',
`    <form class="flats__controls" @submit.prevent="load()">`,
`    <form ref="filtersEl" class="flats__controls" @submit.prevent="load()">`)

replaceOnce('advanced controls',
`        <label class="flats__field">
          <span class="flats__field-label">{{ t("agency") }}</span>
          <u-select-menu v-model="agencySel" :items="agencyItems" value-key="value" label-key="label"
              :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("priceMin") }}</span>`,
`        <label class="flats__field">
          <span class="flats__field-label">{{ t("agency") }}</span>
          <u-select-menu v-model="agencySel" :items="agencyItems" value-key="value" label-key="label"
              :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label v-if="metroOptions.length" class="flats__field">
          <span class="flats__field-label">{{ filterLabel("metro") }}</span>
          <u-select-menu v-model="metroSel" :items="metroItems" value-key="value" label-key="label" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ filterLabel("audience") }}</span>
          <u-select-menu v-model="audienceSel" :items="audienceItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <div class="flats__toggle-grid">
          <u-button type="button" :variant="petFriendly ? 'solid' : 'outline'" color="neutral" icon="i-lucide-paw-print" :aria-pressed="petFriendly" @click="petFriendly = !petFriendly; scheduleLoad(80)">{{ filterLabel("pets") }}</u-button>
          <u-button type="button" :variant="roomOnlyFilter ? 'solid' : 'outline'" color="neutral" icon="i-lucide-bed-single" :aria-pressed="roomOnlyFilter" @click="roomOnlyFilter = !roomOnlyFilter; scheduleLoad(80)">{{ filterLabel("roomOnly") }}</u-button>
          <u-button type="button" :variant="childrenRequired ? 'solid' : 'outline'" color="neutral" icon="i-lucide-baby" :aria-pressed="childrenRequired" @click="childrenRequired = !childrenRequired; scheduleLoad(80)">{{ filterLabel("children") }}</u-button>
          <u-button type="button" :variant="newBuildingOnly ? 'solid' : 'outline'" color="neutral" icon="i-lucide-building-2" :aria-pressed="newBuildingOnly" @click="newBuildingOnly = !newBuildingOnly; scheduleLoad(80)">{{ filterLabel("newBuilding") }}</u-button>
        </div>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("priceMin") }}</span>`)

replaceOnce('after rooms min',
`        <label class="flats__field">
          <span class="flats__field-label">{{ t("roomsMin") }}</span>
          <u-input v-model.number="roomsMin" type="number" icon="i-lucide-bed-double" @change="scheduleLoad()" />
        </label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">`,
`        <label class="flats__field">
          <span class="flats__field-label">{{ t("roomsMin") }}</span>
          <u-input v-model.number="roomsMin" type="number" min="0" icon="i-lucide-bed-double" @change="scheduleLoad()" />
        </label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("roomsMax") }}</span><u-input v-model.number="roomsMax" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("bedroomsMin") }}</span><u-input v-model.number="bedroomsMin" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("bedroomsMax") }}</span><u-input v-model.number="bedroomsMax" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("areaMin") }}</span><u-input v-model.number="areaMin" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("areaMax") }}</span><u-input v-model.number="areaMax" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("floorMin") }}</span><u-input v-model.number="floorMin" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("floorMax") }}</span><u-input v-model.number="floorMax" type="number" min="0" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("totalFloorsMin") }}</span><u-input v-model.number="totalFloorsMin" type="number" min="1" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("totalFloorsMax") }}</span><u-input v-model.number="totalFloorsMax" type="number" min="1" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("yearMin") }}</span><u-input v-model.number="yearMin" type="number" min="1800" :max="new Date().getFullYear() + 2" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("yearMax") }}</span><u-input v-model.number="yearMax" type="number" min="1800" :max="new Date().getFullYear() + 2" @change="scheduleLoad()" /></label>
        <label class="flats__field"><span class="flats__field-label">{{ filterLabel("freshDays") }}</span><u-input v-model.number="maxAgeDays" type="number" min="1" max="21" @change="scheduleLoad()" /></label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">`)

replaceOnce('top button template',
`    <u-modal v-model:open="listingShareModalOpen" :title="t('shareListing')">`,
`    <button v-if="showBackToTop" type="button" class="flats__back-top" :aria-label="filterLabel('backToTop')" @click="scrollToFilters">
      <u-icon name="i-lucide-arrow-up" />
      <span>{{ filterLabel("backToTop") }}</span>
    </button>

    <u-modal v-model:open="listingShareModalOpen" :title="t('shareListing')">`)

replaceOnce('styles',
`.flats__select :deep(button) { width: 100%; }
.flats__error`,
`.flats__select :deep(button) { width: 100%; }
.flats__toggle-grid { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.flats__toggle-grid :deep(button) { width: 100%; justify-content: center; min-height: 38px; }
.flats__back-top { position: fixed; right: 22px; bottom: 24px; z-index: 60; display: inline-flex; align-items: center; gap: 7px; min-height: 42px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg-panel); color: var(--text-primary); box-shadow: 0 8px 26px rgba(0,0,0,.28); cursor: pointer; }
.flats__back-top:hover { color: var(--accent-pink); border-color: rgba(224,103,154,.48); }
.flats__error`)

replaceOnce('mobile toggle style',
`  .flats__views { padding-left: 0; border-left: 0; }
  .flat-card__photo`,
`  .flats__views { padding-left: 0; border-left: 0; }
  .flats__toggle-grid { grid-template-columns: 1fr; }
  .flats__back-top span { display: none; }
  .flats__back-top { right: 14px; bottom: 18px; width: 44px; padding: 0; justify-content: center; }
  .flat-card__photo`)

fs.writeFileSync(path, source)
console.log('Complete Flat Finder web UI patch applied')
