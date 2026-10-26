<script setup lang="ts">
import FlatContactActions from "~/components/flats/FlatContactActions.vue";
import type { ActivityDuplicates, ActivityHistory, ActivityTab, DuplicateListing } from "~/types/listingActivity";
const props = withDefaults(defineProps<{ publicId?: number | null; domain: "flats" | "jobs"; contactCount?: number }>(), { contactCount: 0, publicId: null });
const tab = defineModel<ActivityTab>({ default: "details" });
const instanceId = useId();
const { t, locale } = useI18n();
const history = ref<ActivityHistory | null>(null);
const duplicates = ref<ActivityDuplicates | null>(null);
const originalListing = computed(() => duplicates.value?.origin?.status === "candidate"
  ? duplicates.value.groups.flatMap((group) => group.listings).find((listing) => listing.publicId === duplicates.value?.origin?.candidatePublicId)
  : undefined);
const loading = reactive({ history: false, duplicates: false });
const failed = reactive({ history: false, duplicates: false });
let generation = 0;
let controller: AbortController | undefined;
const tabs = computed(() => [
  { key: "details", label: t("listingActivity.details") },
  ...(props.contactCount > 0 ? [{ key: "contact", label: t("flats.contactListingsTab", { n: props.contactCount }) }] : []),
  { key: "history", label: t("listingActivity.history") },
  { key: "duplicates", label: `${t(props.domain === "jobs" ? "listingActivity.jobDuplicates" : "listingActivity.duplicates")}${duplicates.value ? ` · ${duplicates.value.duplicateCount}` : ""}` },
]);

async function load(section: "history" | "duplicates", more = false) {
  if (!props.publicId || loading[section]) return;
  const requestGeneration = generation;
  loading[section] = true;
  failed[section] = false;
  try {
    const data = await $fetch<ActivityHistory | ActivityDuplicates>(`/${props.domain}-activity`, {
      params: { publicId: props.publicId, section, ...(more && history.value?.nextCursor ? { before: history.value.nextCursor } : {}) },
      signal: controller?.signal, timeout: 15_000, retry: 0,
    });
    if (requestGeneration !== generation) return;
    if (section === "duplicates") duplicates.value = data as ActivityDuplicates;
    else {
      const next = data as ActivityHistory;
      history.value = more && history.value ? { ...next, events: [...history.value.events, ...next.events] } : next;
    }
  } catch {
    if (requestGeneration === generation) failed[section] = true;
  } finally {
    if (requestGeneration === generation) loading[section] = false;
  }
}
watch(() => [props.publicId, props.domain] as const, () => {
  generation++;
  controller?.abort();
  controller = new AbortController();
  history.value = null;
  duplicates.value = null;
  loading.history = loading.duplicates = false;
  failed.history = failed.duplicates = false;
  if (props.publicId) {
    if (tab.value === "history") void load("history");
    void load("duplicates");
  }
}, { immediate: true });
watch(tab, (value) => {
  if (value === "history" && !history.value) void load("history");
});
onBeforeUnmount(() => {
  generation++;
  controller?.abort();
});

const date = (value?: string | null, time = false) => {
  if (!value) return t("listingActivity.unknownDate");
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(locale.value, {
    day: "numeric", month: "long", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }) : t("listingActivity.unknownDate");
};
const sourceUrl = (value?: string | null) => {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const sourceLabel = (listing: DuplicateListing) => {
  const url = sourceUrl(listing.url);
  return url ? new URL(url).hostname.replace(/^www\./, "") : listing.source;
};
const salaryLabel = (listing: DuplicateListing) => {
  const salary = listing.salary;
  if (!salary || (salary.min == null && salary.max == null)) {
    return t(salary?.negotiable ? "jobs.salaryNegotiable" : "listingActivity.salaryUnknown");
  }
  const number = (value: number) => value.toLocaleString(locale.value);
  const amount = salary.min != null && salary.max != null
    ? salary.min === salary.max ? number(salary.min) : `${number(salary.min)}–${number(salary.max)}`
    : salary.min != null ? `${t("jobs.salaryFrom")} ${number(salary.min)}` : `${t("jobs.salaryTo")} ${number(salary.max!)}`;
  const period = salary.period ? ` / ${t(`listingActivity.salaryPeriods.${salary.period}`)}` : "";
  return `${amount} ${salary.currency || ""}${period}`.trim();
};
function onTabKey(event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button"));
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault();
  buttons[next]?.click();
  buttons[next]?.focus();
}
</script>

<template>
  <div class="listing-activity">
    <div class="listing-activity__tabs" role="tablist" :aria-label="t('listingActivity.sections')" @keydown="onTabKey">
      <button v-for="item in tabs" :id="`${instanceId}-tab-${item.key}`" :key="item.key" type="button" role="tab" :aria-controls="`${instanceId}-panel-${item.key}`" :aria-selected="tab === item.key" :tabindex="tab === item.key ? 0 : -1" @click="tab = item.key as ActivityTab">{{ item.label }}</button>
    </div>
    <div v-show="tab === 'details'" :id="`${instanceId}-panel-details`" :aria-labelledby="`${instanceId}-tab-details`" role="tabpanel"><slot /></div>
    <div v-if="tab === 'contact'" :id="`${instanceId}-panel-contact`" :aria-labelledby="`${instanceId}-tab-contact`" role="tabpanel"><slot name="contact" /></div>
    <section v-if="tab === 'history'" :id="`${instanceId}-panel-history`" :aria-labelledby="`${instanceId}-tab-history`" class="listing-activity__panel" role="tabpanel" aria-live="polite">
      <p v-if="!publicId">{{ t("listingActivity.unavailable") }}</p>
      <p v-else-if="loading.history && !history">{{ t("listingActivity.loading") }}</p>
      <template v-if="history">
        <p class="listing-activity__summary">{{ t("listingActivity.firstSeen") }}: <b>{{ date(history.firstSeenAt) }}</b></p>
        <ol class="listing-activity__timeline">
          <li v-for="event in history.events" :key="event.id">
            <time>{{ date(event.observedAt, true) }}</time>
            <strong>{{ t(`listingActivity.events.${event.kind}`) }}</strong>
            <span v-if="event.kind === 'price_changed'">{{ event.price == null ? t("listingActivity.notSpecified") : `${Number(event.price).toLocaleString(locale)} ${event.currency || ''}` }}</span>
            <span v-if="event.kind === 'salary_changed'">{{ event.salary || t("listingActivity.notSpecified") }}</span>
            <span v-if="event.kind === 'date_updated' && event.sourcePublishedAt">{{ t("listingActivity.sourceDate") }}: {{ date(event.sourcePublishedAt, true) }}</span>
          </li>
          <li v-if="!history.nextCursor"><time>{{ date(history.firstSeenAt, true) }}</time><strong>{{ t("listingActivity.firstSeen") }}</strong></li>
        </ol>
        <button v-if="history.nextCursor" type="button" class="listing-activity__link" :disabled="loading.history" @click="load('history', true)">{{ t(loading.history ? "listingActivity.loading" : "listingActivity.older") }}</button>
        <p class="listing-activity__note">{{ t("listingActivity.historyNote") }}</p>
        <p v-if="domain === 'jobs'" class="listing-activity__note">{{ t("listingActivity.jobNote") }}</p>
      </template>
      <p v-if="failed.history" role="status">{{ t("listingActivity.failed") }} <button type="button" class="listing-activity__link" @click="load('history', Boolean(history?.nextCursor))">{{ t("listingActivity.retry") }}</button></p>
    </section>
    <section v-if="tab === 'duplicates'" :id="`${instanceId}-panel-duplicates`" :aria-labelledby="`${instanceId}-tab-duplicates`" class="listing-activity__panel" role="tabpanel" aria-live="polite">
      <p v-if="!publicId">{{ t("listingActivity.unavailable") }}</p>
      <p v-else-if="loading.duplicates">{{ t("listingActivity.loading") }}</p>
      <p v-if="failed.duplicates" role="status">{{ t("listingActivity.failed") }} <button type="button" class="listing-activity__link" @click="load('duplicates')">{{ t("listingActivity.retry") }}</button></p>
      <template v-if="duplicates">
        <p v-if="!duplicates.duplicateCount">{{ t("listingActivity.noDuplicates") }}</p>
        <template v-else>
          <section v-if="duplicates.origin" class="listing-activity__origin">
            <template v-if="duplicates.origin.status === 'candidate' && originalListing">
              <h4>{{ t("listingActivity.origin.title") }} · #{{ originalListing.publicId }}</h4>
              <p class="listing-activity__note">{{ t("listingActivity.origin.confidenceModerate") }}</p>
              <ul><li v-for="reason in duplicates.origin.evidence" :key="reason">{{ t(`listingActivity.origin.evidence.${reason}`) }}</li></ul>
              <a v-if="sourceUrl(originalListing.url)" :href="sourceUrl(originalListing.url)" target="_blank" rel="noopener noreferrer" class="listing-activity__link">{{ t("listingActivity.origin.openCandidate") }} ↗</a>
              <p class="listing-activity__note">{{ t(domain === 'jobs' ? "listingActivity.origin.jobLimit" : "listingActivity.origin.ownerLimit") }}</p>
            </template>
            <template v-else>
              <h4>{{ t("listingActivity.origin.undetermined") }}</h4>
              <p class="listing-activity__note">{{ t(duplicates.origin.status === 'ambiguous' ? "listingActivity.origin.ambiguous" : "listingActivity.origin.insufficient") }}</p>
            </template>
          </section>
          <p class="listing-activity__note">{{ t(domain === 'jobs' ? "listingActivity.roleNote" : "listingActivity.ownerNote") }}</p>
          <section v-for="(group, index) in duplicates.groups" :key="group.key" class="listing-activity__group">
            <h4>{{ domain === 'jobs' ? (group.company || group.listings[0]?.company || t("listingActivity.advertiser")) : group.contact || t("listingActivity.unknownAdvertiser", { n: index + 1 }) }}</h4>
            <p v-if="domain === 'jobs'" class="listing-activity__note">{{ t(`listingActivity.advertisers.${group.advertiserType || 'unknown'}`) }} · {{ t("listingActivity.postings", { n: group.listings.length }) }}</p>
            <p v-if="domain === 'flats'" class="listing-activity__note">{{ t(group.sameAdvertiser ? "listingActivity.sameContact" : group.contact ? "listingActivity.otherContact" : "listingActivity.contactUnknown") }} · {{ t("listingActivity.postings", { n: group.listings.length }) }}</p>
            <FlatContactActions v-if="domain === 'flats' && group.listings[0]?.contactActions" :actions="group.listings[0].contactActions" />
            <article v-for="listing in group.listings" :key="listing.publicId" class="listing-activity__duplicate" :class="{ 'listing-activity__duplicate_origin': originalListing?.publicId === listing.publicId }">
              <div class="listing-activity__duplicate-head"><b>{{ sourceLabel(listing) }} · #{{ listing.publicId }}</b><span v-if="listing.current" class="listing-activity__tag">{{ t("listingActivity.current") }}</span><span v-if="!listing.active" class="listing-activity__tag">{{ t("listingActivity.inactive") }}</span></div>
              <span v-if="originalListing?.publicId === listing.publicId" class="listing-activity__origin-tag">{{ t("listingActivity.origin.title") }}</span>
              <p>{{ listing.title }}</p>
              <p v-if="domain === 'jobs'" class="listing-activity__salary"><b>{{ salaryLabel(listing) }}</b><span v-if="listing.salary?.gross != null"> · {{ t(listing.salary.gross ? "jobs.salaryGross" : "jobs.salaryNet") }}</span></p>
              <div class="listing-activity__facts"><span>{{ t(`listingActivity.advertisers.${listing.advertiserType}`) }}</span><b v-if="listing.price != null">{{ Number(listing.price).toLocaleString(locale) }} {{ listing.currency }}</b><span v-if="domain === 'flats'">{{ t(listing.commission === true ? "listingActivity.commissionYes" : listing.commission === false ? "listingActivity.commissionNo" : "listingActivity.commissionUnknown") }}<template v-if="listing.commissionPercent != null"> · {{ listing.commissionPercent }}%</template></span></div>
              <p v-if="listing.commissionAmount" class="listing-activity__note">{{ t("listingActivity.commissionYes") }}: {{ listing.commissionAmount.amount.toLocaleString(locale) }} {{ listing.commissionAmount.currency }}</p>
              <p class="listing-activity__note">{{ t("listingActivity.firstSeen") }}: {{ date(listing.firstSeenAt) }}<template v-if="listing.matchKind !== 'current'"> · {{ t(`listingActivity.matches.${listing.matchKind}`) }}</template></p>
              <p v-if="domain === 'jobs' && listing.sourcePublishedAt" class="listing-activity__note">{{ t("listingActivity.sourceDate") }}: {{ date(listing.sourcePublishedAt, true) }}</p>
              <a v-if="sourceUrl(listing.url)" :href="sourceUrl(listing.url)" target="_blank" rel="noopener noreferrer" class="listing-activity__link">{{ t("listingActivity.original") }} ↗</a>
              <a v-if="domain === 'jobs' && sourceUrl(listing.applyUrl) && sourceUrl(listing.applyUrl) !== sourceUrl(listing.url)" :href="sourceUrl(listing.applyUrl)" target="_blank" rel="noopener noreferrer" class="listing-activity__link listing-activity__apply">{{ t("jobs.apply") }} ↗</a>
            </article>
          </section>
        </template>
      </template>
    </section>
  </div>
</template>

<style scoped>
.listing-activity { min-width: 0; }
.listing-activity__tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.listing-activity__tabs button { min-height: 34px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--text-muted); font-size: 13px; cursor: pointer; }
.listing-activity__tabs button[aria-selected="true"] { border-color: var(--accent-pink); color: var(--text-primary); }
.listing-activity__panel { font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }
.listing-activity__summary { padding-bottom: 14px; border-bottom: 1px solid var(--line); color: var(--text-muted); margin: 0 0 16px; }
.listing-activity__summary b { color: var(--text-primary); font-weight: 500; }
.listing-activity__timeline { list-style: none; padding: 0; margin: 0; }
.listing-activity__timeline li { position: relative; margin-left: 5px; padding: 0 0 19px 23px; border-left: 1px solid var(--line); }
.listing-activity__timeline li::before { content: ''; position: absolute; left: -4px; top: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-blue); box-shadow: 0 0 0 4px var(--bg-panel); }
.listing-activity__timeline li:first-child::before { background: var(--accent-pink); }
.listing-activity__timeline li:last-child { border-left-color: transparent; }
.listing-activity__timeline time, .listing-activity__timeline span { display: block; color: var(--text-muted); font-size: 12px; }
.listing-activity__timeline strong { display: block; font-weight: 500; }
.listing-activity__note { color: var(--text-muted); font-size: 12px; line-height: 1.6; margin: 8px 0 12px; }
.listing-activity__link { color: var(--accent-pink); padding: 4px 0; border: 0; background: transparent; font: inherit; cursor: pointer; display: inline-block; }
.listing-activity__group { margin-top: 20px; }
.listing-activity__group h4 { font-size: 14px; margin: 0; }
.listing-activity__duplicate { padding: 12px; margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-panel-2); }
.listing-activity__duplicate p { margin: 6px 0; }
.listing-activity__duplicate-head, .listing-activity__facts { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; }
.listing-activity__duplicate-head { font-size: 12px; }
.listing-activity__tag { color: var(--text-muted); font-size: 11px; }
.listing-activity__facts { font-size: 12px; color: var(--text-soft); }
.listing-activity__salary { color: var(--text-primary); }
.listing-activity__salary span { color: var(--text-muted); font-size: 12px; }
.listing-activity__apply { margin-left: 16px; }
.listing-activity__origin { border: 1px solid var(--line); background: var(--bg-panel-2); border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.listing-activity__origin h4 { margin: 0; font-size: 14px; font-weight: 600; }
.listing-activity__origin ul { padding-left: 18px; margin: 8px 0; color: var(--text-soft); font-size: 12px; }
.listing-activity__duplicate_origin { border-color: var(--accent-pink); }
.listing-activity__origin-tag { display: inline-block; color: var(--accent-pink); font-size: 11px; margin-top: 6px; }
@media (pointer: coarse) { .listing-activity__tabs button, .listing-activity__link { min-height: 44px; } }
</style>
