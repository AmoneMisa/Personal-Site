<script setup lang="ts">
// "Owners" tab: one card per advertiser with two or more properties in the
// selected country, largest first, loaded page by page.
import { type FlatOwner, ownerLabel } from "~/utils/flats/owners";
import { listingLineOf } from "~/utils/flats/listingLine";

const props = defineProps<{ country: string }>();
const emit = defineEmits<{ select: [owner: FlatOwner] }>();

const { t } = useI18n();
const owners = ref<FlatOwner[]>([]);
const next = ref<string | null>(null);
const loading = ref(false);
const failed = ref(false);

async function load(reset: boolean) {
  if (!props.country || loading.value) return;
  const country = props.country;
  loading.value = true;
  failed.value = false;
  try {
    const data = await $fetch<{ owners: FlatOwner[]; next: string | null }>("/flats-owners", {
      params: { country, ...(reset || !next.value ? {} : { cursor: next.value }) },
    });
    if (country !== props.country) return;
    owners.value = reset ? data.owners : [...owners.value, ...data.owners];
    next.value = data.next;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

watch(() => props.country, () => {
  owners.value = [];
  next.value = null;
  void load(true);
}, { immediate: true });
</script>

<template>
  <section class="flat-owners" aria-live="polite">
    <p class="flat-owners__intro text-muted">{{ t("flats.ownersIntro") }}</p>
    <ul v-if="owners.length" class="flat-owners__grid">
      <li v-for="owner in owners" :key="owner.ownerKey">
        <button
          type="button"
          class="flat-owners__card"
          :class="listingLineOf(owner.listingLine) ? `flat-owners__card_line_${owner.listingLine}` : ''"
          @click="emit('select', owner)"
        >
          <img v-if="owner.sample?.photo" :src="owner.sample.photo" alt="" class="flat-owners__photo" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          <span v-else class="flat-owners__photo flat-owners__photo_empty" aria-hidden="true"><u-icon name="i-lucide-user-round" /></span>
          <span class="flat-owners__text">
            <span class="flat-owners__name">{{ ownerLabel(owner.contact) }}</span>
            <span class="flat-owners__count">{{ t("flats.ownerListings", { n: owner.properties }) }}</span>
            <span v-if="owner.city" class="flat-owners__city text-muted">{{ owner.city }}</span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else-if="!loading && !failed" class="flat-owners__state text-muted">{{ t("flats.ownersEmpty") }}</p>
    <p v-if="failed" class="flat-owners__state text-muted">{{ t("flats.ownersFailed") }}</p>
    <div v-if="next || loading" class="flat-owners__more">
      <u-button type="button" color="neutral" variant="outline" :loading="loading" :disabled="loading" @click="load(false)">{{ t("flats.ownersMore") }}</u-button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.flat-owners { display: grid; gap: 14px; margin-top: 8px; }
.flat-owners__intro { font-size: 13.5px; }
.flat-owners__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.flat-owners__card {
  width: 100%;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 8px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  background: var(--bg-panel);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.flat-owners__card:hover,
.flat-owners__card:focus-visible { transform: translateY(-1px); border-color: var(--accent-pink); }
.flat-owners__card_line_steady { border-color: var(--flat-line-steady); }
.flat-owners__card_line_phantom_risk { border-color: var(--flat-line-phantom); }
.flat-owners__card_line_multi_listing { border-color: var(--flat-line-multi); }
.flat-owners__photo { width: 72px; height: 56px; border-radius: 8px; object-fit: cover; background: var(--bg-panel-2); }
.flat-owners__photo_empty { display: grid; place-items: center; color: var(--text-muted); }
.flat-owners__text { min-width: 0; display: grid; gap: 2px; }
.flat-owners__name { font-weight: 700; font-size: 14.5px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flat-owners__count { font-size: 13px; }
.flat-owners__city { font-size: 12px; }
.flat-owners__state { padding: 18px 4px; }
.flat-owners__more { display: flex; justify-content: center; }
</style>
