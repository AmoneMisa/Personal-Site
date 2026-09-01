<script setup lang="ts">
import { scoreColor } from "~/utils/atsScore";
import { capitalizeFirst } from "~/utils/text";
import type { Job, JobAtsResult } from "~/types/jobs";
import { formatRelativeDate } from "~/utils/search/relativeDate";
import { compactSalaryText } from "~/utils/search/money";
import { localizeJobLanguage } from "~/utils/jobs/languageLabel";
import SearchMatchBadge from "~/components/search/SearchMatchBadge.vue";
import type { DraggablePillItem } from "~/components/ui/DraggablePills.vue";

const props = defineProps<{
  job: Job;
  ats: JobAtsResult | null;
  seen: boolean;
  favorite: boolean;
  hidden: boolean;
  shareCopied: boolean;
  salary: string | null;
  convertedSalary: string | null;
}>();

const emit = defineEmits<{
  open: [job: Job];
  share: [job: Job];
  seen: [job: Job];
  favorite: [job: Job];
  hidden: [job: Job];
}>();

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`jobs.${key}`, params);
const languageLabel = (value: string) => localizeJobLanguage(value, (key) => t(key));

const empLabel = (kind?: string) => kind ? t("emp" + kind.charAt(0).toUpperCase() + kind.slice(1)) : "";
const seniorityLabel = (value?: Job["seniority"]) => value ? t("seniority" + value.charAt(0).toUpperCase() + value.slice(1)) : "";
const employerTypeLabel = (value?: Job["employerType"]) => value ? t("employer" + value.charAt(0).toUpperCase() + value.slice(1)) : "";
function timeAgo(iso: string): string {
  return formatRelativeDate(iso, {
    today: () => t("today"),
    yesterday: () => t("yesterday"),
    daysAgo: (n) => t("daysAgo", { n }),
    monthsAgo: (n) => t("monthsAgo", { n }),
  });
}

function suspicionHint(job: Job): string {
  const reasons = (job.suspicionReasons || []).map((reason) => t(`susp_${reason.replace(/-/g, "_")}`));
  return reasons.length ? `${t("suspiciousWhy")}: ${reasons.join("; ")}` : t("suspiciousWhy");
}

const cardBadges = computed(() => [
  employerTypeLabel(props.job.employerType) ? { label: employerTypeLabel(props.job.employerType), kind: "source" } : null,
  props.seen ? { label: t("seen"), kind: "seen" } : null,
  props.job.workMode && props.job.workMode !== "unknown" ? { label: t("wm" + props.job.workMode.charAt(0).toUpperCase() + props.job.workMode.slice(1)), kind: "mode" } : props.job.remote ? { label: t("remote"), kind: "mode" } : null,
  empLabel(props.job.employmentKind) ? { label: empLabel(props.job.employmentKind), kind: "employment" } : null,
  seniorityLabel(props.job.seniority) ? { label: seniorityLabel(props.job.seniority), kind: "seniority" } : null,
  props.job.managementRole ? { label: t("management"), kind: "management" } : null,
  props.job.experienceMinYears !== undefined && props.job.experienceMinYears > 0 ? { label: t("experienceYears", { n: props.job.experienceMinYears }), kind: "experience" } : null,
  props.job.foreignerFriendly ? { label: t("cardForeigner"), kind: "visa" } : null,
  props.job.suspicious ? { label: `⚠ ${t("suspicious")}`, kind: "suspicious", title: suspicionHint(props.job) } : null,
  props.job.relocation === "offered" ? { label: t("cardReloc"), kind: "reloc" } : null,
  props.job.salaryNegotiable ? { label: t("salaryNegotiable"), kind: "salary" } : null,
].filter((item): item is { label: string; kind: string; title?: string } => !!item));
const visibleBadges = computed(() => cardBadges.value.slice(0, 6));
const hiddenBadgeCount = computed(() => Math.max(0, cardBadges.value.length - visibleBadges.value.length));
const metaItems = computed(() => {
  const items = visibleBadges.value.map((badge) => ({ ...badge, key: badge.kind + badge.label }));
  if (hiddenBadgeCount.value) {
    items.push({
      label: `+${hiddenBadgeCount.value}`,
      kind: "more",
      title: cardBadges.value.slice(visibleBadges.value.length).map((badge) => badge.label).join(", "),
      key: "more",
    });
  }
  return items;
});
const metaRowA = computed(() => metaItems.value.filter((_, index) => index % 2 === 0));
const metaRowB = computed(() => metaItems.value.filter((_, index) => index % 2 === 1));
const countryLabel = computed(() => props.job.country || props.job.location.split(",").at(-1)?.trim() || "");
const officeLocationsLabel = computed(() => props.job.officeLocations?.length ? props.job.officeLocations.join(" / ") : "");
const bylineTitle = computed(() => [props.job.company, officeLocationsLabel.value || props.job.location].filter(Boolean).join(" · "));
const compactSalary = computed(() => props.salary ? compactSalaryText(props.salary) : null);
const compactConvertedSalary = computed(() => props.convertedSalary ? compactSalaryText(props.convertedSalary) : null);

const pills = (items: string[] | undefined, className: string, prefix = ""): DraggablePillItem[] =>
  (items || []).map((label, index) => ({ key: `${prefix}${label}:${index}`, label: prefix ? `${prefix}${label}` : label, className }));
const atsMatchedPills = computed(() => pills(props.ats?.matched, "job-card__tag job-card__tag_match"));
const atsMissingPills = computed(() => pills(props.ats?.missing, "job-card__tag job-card__tag_miss"));
const skillPills = computed(() => [
  ...pills(props.job.skills, "job-card__tag job-card__tag_skill"),
  ...pills(props.job.niceToHave, "job-card__tag job-card__tag_plus", "+"),
]);
function pillKey(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}+#.]+/gu, " ").trim().toLocaleLowerCase("en");
}
const tagPills = computed(() => {
  const company = pillKey(props.job.company || "");
  return pills((props.job.tags || []).filter((tag) => pillKey(tag) !== company), "job-card__tag");
});
function openCard() { emit("open", props.job); }

const metaRail = ref<HTMLElement | null>(null);
let metaPointerId: number | null = null;
let metaStartX = 0;
let metaStartScrollLeft = 0;

function startMetaDrag(event: PointerEvent) {
  if (event.pointerType === "touch" || !metaRail.value) return;
  metaPointerId = event.pointerId;
  metaStartX = event.clientX;
  metaStartScrollLeft = metaRail.value.scrollLeft;
  metaRail.value.setPointerCapture(event.pointerId);
  metaRail.value.classList.add("is-dragging");
}

function moveMetaDrag(event: PointerEvent) {
  if (metaPointerId !== event.pointerId || !metaRail.value) return;
  metaRail.value.scrollLeft = metaStartScrollLeft - (event.clientX - metaStartX);
}

function stopMetaDrag(event: PointerEvent) {
  if (metaPointerId !== event.pointerId || !metaRail.value) return;
  if (metaRail.value.hasPointerCapture(event.pointerId)) metaRail.value.releasePointerCapture(event.pointerId);
  metaRail.value.classList.remove("is-dragging");
  metaPointerId = null;
}
</script>

<template>
  <article
    class="job-card"
    :class="{
      'job-card_scored': ats,
      'job-card_seen': seen,
      'job-card_favorite': favorite,
      'job-card_hidden': hidden,
    }"
    :style="ats ? { '--job-card-score': scoreColor(ats.score) } : undefined"
    tabindex="0"
    @click="openCard"
    @keydown.enter.self="emit('open', job)"
  >
    <div class="job-card__head">
      <h3 class="job-card__title">{{ job.title }}</h3>
      <div class="job-card__head-side">
        <SearchMatchBadge
          v-if="ats"
          class="job-card__ats"
          :value="ats.score"
          :tier="ats.score >= 75 ? 'good' : ats.score >= 50 ? 'warning' : 'bad'"
          :style="{ color: scoreColor(ats.score), borderColor: scoreColor(ats.score) }"
          :title="ats.missing.length ? t('atsMissing') + ': ' + ats.missing.join(', ') : ''"
        />
        <span class="job-card__date text-muted">{{ timeAgo(job.postedAt) }}</span>
      </div>
    </div>

    <div
      ref="metaRail"
      class="job-card__meta"
      @click.stop
      @pointerdown.stop="startMetaDrag"
      @pointermove.stop="moveMetaDrag"
      @pointerup.stop="stopMetaDrag"
      @pointercancel.stop="stopMetaDrag"
    >
      <div class="job-card__meta-row">
        <span v-for="badge in metaRowA" :key="badge.key" class="job-card__badge" :class="`job-card__badge_${badge.kind}`" :title="badge.title">{{ badge.label }}</span>
      </div>
      <div class="job-card__meta-row">
        <span v-for="badge in metaRowB" :key="badge.key" class="job-card__badge" :class="`job-card__badge_${badge.kind}`" :title="badge.title">{{ badge.label }}</span>
      </div>
    </div>

    <div v-if="salary || convertedSalary" class="job-card__compensation">
      <div class="job-card__salary-values">
        <span v-if="salary" class="job-card__salary" :title="salary">{{ compactSalary }}</span>
        <span v-if="salary && convertedSalary" class="job-card__salary-separator" aria-hidden="true">·</span>
        <span v-if="convertedSalary" class="job-card__salary job-card__salary_conv" :title="convertedSalary">{{ compactConvertedSalary }}</span>
      </div>
    </div>

    <div v-if="job.languages?.length" class="job-card__langs text-muted">
      <u-icon name="i-lucide-languages" class="job-card__lang-icon" />
      <span v-for="language in job.languages" :key="language.language" class="job-card__lang">
        {{ languageLabel(language.language) }}<template v-if="language.level"> ({{ language.level }})</template>
      </span>
    </div>
    <p v-if="job.description" class="job-card__desc text-muted">{{ capitalizeFirst(job.description) }}</p>

    <div class="job-card__footer">
      <template v-if="ats">
        <div v-if="ats.matched.length" class="job-card__skills">
          <span class="job-card__skills-label">{{ t("atsMatched") }}</span>
          <UiDraggablePills :items="atsMatchedPills" :visible-hint-count="3" />
        </div>
        <div v-if="ats.missing.length" class="job-card__skills">
          <span class="job-card__skills-label">{{ t("atsMissing") }}</span>
          <UiDraggablePills :items="atsMissingPills" :visible-hint-count="3" />
        </div>
        <div v-if="!ats.matched.length && !ats.missing.length" class="job-card__skills">
          <span class="job-card__skills-label">{{ t("atsNoSkills") }}</span>
        </div>
      </template>
      <div v-else-if="job.skills?.length" class="job-card__tags">
        <UiDraggablePills :items="skillPills" :visible-hint-count="3" />
      </div>
      <div v-else-if="tagPills.length" class="job-card__tags">
        <UiDraggablePills :items="tagPills" :visible-hint-count="3" />
      </div>
      <div class="job-card__bottom">
        <div class="job-card__byline text-muted" :title="bylineTitle"><span class="job-card__company">{{ job.company }}</span><span v-if="officeLocationsLabel" class="job-card__dot">·</span><span v-if="officeLocationsLabel">{{ officeLocationsLabel }}</span><template v-else-if="countryLabel"><span class="job-card__dot">·</span><span>{{ countryLabel }}</span></template></div>
        <div class="job-card__actions">
          <button type="button" class="job-card__action" :class="{ 'job-card__action_active': favorite }" :aria-label="favorite ? t('removeFavorite') : t('addFavorite')" :title="favorite ? t('removeFavorite') : t('addFavorite')" @click.stop="emit('favorite', job)">
            <u-icon name="i-lucide-heart" />
          </button>
          <button type="button" class="job-card__action" :aria-label="hidden ? t('restoreVacancy') : t('hideVacancy')" :title="hidden ? t('restoreVacancy') : t('hideVacancy')" @click.stop="emit('hidden', job)">
            <u-icon :name="hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.job-card { position: relative; isolation: isolate; overflow: hidden; padding: 18px; border-radius: 14px; border: 1px solid var(--line); background: var(--bg-panel); box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 16px 36px rgba(2,6,23,.12); transition: transform 160ms ease, border-color 180ms ease, box-shadow 180ms ease; height: auto; min-height: 0; display: flex; flex-direction: column; cursor: pointer; }
.job-card:focus-visible { outline: 2px solid var(--accent-pink, #e0679a); outline-offset: 3px; }
.job-card_scored { border-color: var(--line); box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 16px 36px rgba(2,6,23,.12); }
.job-card:hover { transform: translateY(-3px); border-color: rgba(224,103,154,.42); box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 20px 42px rgba(2,6,23,.22); }
.job-card_scored:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 20px 42px rgba(2,6,23,.22); }
.job-card__head { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: start; gap: 12px; }
.job-card__head-side { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; min-width: 48px; }
.job-card__title { width: 100%; min-width: 0; margin: 0; overflow-wrap: break-word; font-weight: 700; font-size: 15px; line-height: 1.4; color: var(--text-white, inherit); }
.job-card__ats { justify-self: end; white-space: nowrap; font-size: 11px; font-weight: 700; padding: 2px 8px; border: 1px solid; border-radius: 7px; background: rgba(2,6,23,.18); }
.job-card__date { min-width: 0; font-size: 11px; line-height: 1.2; white-space: nowrap; }
.job-card__meta { display: flex; flex-direction: column; gap: 5px; overflow-x: auto; overflow-y: hidden; margin-top: 9px; scrollbar-width: none; touch-action: pan-x; cursor: grab; user-select: none; }
.job-card__meta::-webkit-scrollbar { display: none; }

.job-card__meta-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 5px; }
.job-card__badge { flex: 0 0 auto; white-space: nowrap; border-radius: 6px; padding: 2px 8px; font-size: 11px; line-height: 1.35; color: #34d399; background: rgba(52,211,153,.14); }
.job-card__badge_mode { color: #38bdf8; background: rgba(56,189,248,.14); }
.job-card__badge_visa { color: #fbbf24; background: rgba(251,191,36,.14); }
.job-card__badge_suspicious { color: #f87171; background: rgba(248,113,113,.14); cursor: help; }
.job-card__badge_reloc { color: #f472b6; background: rgba(244,114,182,.14); }
.job-card__badge_source { color: #c4b5fd; background: rgba(167,139,250,.14); }
.job-card__badge_new { color: #6ee7b7; background: rgba(52,211,153,.14); }

.job-card__badge_seniority { color: #f9a8d4; background: rgba(236,72,153,.13); }
.job-card__badge_management { color: #fcd34d; background: rgba(245,158,11,.13); }
.job-card__badge_salary { color: #f0abfc; background: rgba(217,70,239,.12); }

.job-card__compensation { min-width: 0; margin-top: 12px; }
.job-card__salary-values { display: flex; min-width: 0; align-items: baseline; gap: 5px; flex-wrap: nowrap; white-space: nowrap; overflow: hidden; }
.job-card__salary { color: #f08ab8; min-width: 0; flex: 0 1 auto; font-size: 14px; line-height: 1.3; font-weight: 750; letter-spacing: .01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.job-card__salary-separator { flex: none; color: var(--ui-text-muted); opacity: .65; }
.job-card__salary_conv { color: var(--ui-text-muted); font-size: 12.5px; font-weight: 600; opacity: .92; }
.job-card__langs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; }
.job-card__lang-icon { font-size: 14px; opacity: .7; }
.job-card__lang:not(:last-child)::after { content: ","; }
.job-card__desc { margin-top: 10px; font-size: 13px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.job-card__footer { display: flex; flex-direction: column; margin-top: 12px; padding-top: 0; }
.job-card__tags, .job-card__skills { position: relative; min-width: 0; display: flex; gap: 6px; align-items: center; }
.job-card__skills { flex-wrap: wrap; }
.job-card__skills + .job-card__skills { margin-top: 9px; }
.job-card__skills-label { flex-basis: 100%; font-size: 11px; line-height: 1.3; opacity: .72; }

.job-card__bottom { display: flex; min-width: 0; align-items: center; gap: 10px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(86,96,135,.22); }
.job-card__byline { display: flex; min-width: 0; flex: 1 1 auto; align-items: center; gap: 5px; font-size: 12px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.job-card__byline > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.job-card__company { font-weight: 600; flex: 0 1 auto; }
.job-card__dot { opacity: .5; }
.job-card__actions { flex: 0 0 auto; margin-left: auto; display: flex; justify-content: flex-end; align-items: center; gap: 4px; }
.job-card__action { width: 27px; height: 27px; display: inline-grid; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-panel-2); color: var(--ui-text-muted); cursor: pointer; transition: color 160ms ease, border-color 160ms ease, background 160ms ease; }
.job-card__action :deep(svg) { display: block; margin: auto; }
.job-card__action:hover { color: var(--accent-pink, #e0679a); border-color: rgba(224,103,154,.45); }
.job-card__action_active { color: var(--accent-pink, #e0679a); background: rgba(224,103,154,.12); }
.job-card_seen { opacity: .72; }
.job-card_seen:hover { opacity: 1; }
.job-card_favorite { border-color: rgba(224,103,154,.48); }
.job-card_hidden { opacity: .62; border-style: dashed; }

/* Salary is shown once in the modal specification table. The legacy summary
   badge/value row is kept out of view while the page markup is shared with
   older cached bundles; "negotiable" remains visible because it is distinct. */
:global(.job-modal__badges > .job-card__salary) { display: none; }
:global(.job-modal__badges > .job-card__badge_salary:has(+ .job-card__salary)),
:global(.job-modal__badges > .job-card__badge_salary:has(+ .job-card__badge_salary)) { display: none; }

@include bp-down(xs) {
  .job-card { padding: 15px; }
  .job-card__head { gap: 8px; }
  .job-card__salary { font-size: 13px; }
  .job-card__salary_conv { font-size: 11.5px; }
  .job-card__bottom { gap: 6px; }
}
</style>
