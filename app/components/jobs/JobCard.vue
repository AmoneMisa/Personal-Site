<script setup lang="ts">
import { scoreColor } from "~/utils/atsScore";
import type { Job, JobAtsResult } from "~/types/jobs";

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

const empLabel = (kind?: string) => kind ? t("emp" + kind.charAt(0).toUpperCase() + kind.slice(1)) : "";
const seniorityLabel = (value?: Job["seniority"]) => value ? t("seniority" + value.charAt(0).toUpperCase() + value.slice(1)) : "";
const employerTypeLabel = (value?: Job["employerType"]) => value ? t("employer" + value.charAt(0).toUpperCase() + value.slice(1)) : "";
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 30) return t("daysAgo", { n: days });
  return t("monthsAgo", { n: Math.floor(days / 30) });
}

function suspicionHint(job: Job): string {
  const reasons = (job.suspicionReasons || []).map((reason) => t(`susp_${reason.replace(/-/g, "_")}`));
  return reasons.length ? `${t("suspiciousWhy")}: ${reasons.join("; ")}` : t("suspiciousWhy");
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
  >
    <div class="job-card__head">
      <button type="button" class="job-card__title" @click="emit('open', job)">{{ job.title }}</button>
      <span
        v-if="ats"
        class="job-card__ats"
        :style="{ color: scoreColor(ats.score), borderColor: scoreColor(ats.score) }"
        :title="ats.missing.length ? t('atsMissing') + ': ' + ats.missing.join(', ') : ''"
      >{{ ats.score }}% {{ t("atsMatch") }}</span>
    </div>

    <div class="job-card__meta-row">
      <div class="job-card__byline text-muted">
        <span class="job-card__company">{{ job.company }}</span>
        <span class="job-card__dot">·</span>
        <span>{{ job.location }}</span>
        <span class="job-card__dot">·</span>
        <span>{{ timeAgo(job.postedAt) }}</span>
      </div>
      <div class="job-card__actions">
        <button type="button" class="job-card__action" :aria-label="t('share')" :title="t('share')" @click="emit('share', job)">
          <u-icon :name="shareCopied ? 'i-lucide-check' : 'i-lucide-share-2'" />
        </button>
        <a :href="job.url" target="_blank" rel="noopener noreferrer" class="job-card__action" :aria-label="t('openSource')" :title="t('openSource')" @click="emit('seen', job)">
          <u-icon name="i-lucide-external-link" />
        </a>
        <button type="button" class="job-card__action" :class="{ 'job-card__action_active': favorite }" :aria-label="favorite ? t('removeFavorite') : t('addFavorite')" :title="favorite ? t('removeFavorite') : t('addFavorite')" @click="emit('favorite', job)">
          <u-icon name="i-lucide-heart" />
        </button>
        <button type="button" class="job-card__action" :aria-label="hidden ? t('restoreVacancy') : t('hideVacancy')" :title="hidden ? t('restoreVacancy') : t('hideVacancy')" @click="emit('hidden', job)">
          <u-icon :name="hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'" />
        </button>
      </div>
    </div>

    <div class="job-card__meta">
      <span v-if="employerTypeLabel(job.employerType)" class="job-card__badge job-card__badge_source">{{ employerTypeLabel(job.employerType) }}</span>
      <span v-if="isToday(job.postedAt)" class="job-card__badge job-card__badge_new">{{ t("newToday") }}</span>
      <span v-if="seen" class="job-card__badge job-card__badge_seen">{{ t("seen") }}</span>
      <span v-if="job.workMode && job.workMode !== 'unknown'" class="job-card__badge job-card__badge_mode">{{ t("wm" + job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)) }}</span>
      <span v-else-if="job.remote" class="job-card__badge">{{ t("remote") }}</span>
      <span v-if="empLabel(job.employmentKind)" class="job-card__badge job-card__badge_employment">{{ empLabel(job.employmentKind) }}</span>
      <span v-if="seniorityLabel(job.seniority)" class="job-card__badge job-card__badge_seniority">{{ seniorityLabel(job.seniority) }}</span>
      <span v-if="job.managementRole" class="job-card__badge job-card__badge_management">{{ t("management") }}</span>
      <span v-if="job.experienceMinYears !== undefined && job.experienceMinYears > 0" class="job-card__badge">{{ t("experienceYears", { n: job.experienceMinYears }) }}</span>
      <span v-if="job.foreignerFriendly" class="job-card__badge job-card__badge_visa">{{ t("cardForeigner") }}</span>
      <span v-if="job.suspicious" class="job-card__badge job-card__badge_suspicious" :title="suspicionHint(job)">⚠ {{ t("suspicious") }}</span>
      <span v-if="job.relocation === 'offered'" class="job-card__badge job-card__badge_reloc">{{ t("cardReloc") }}</span>
      <span v-if="job.salaryNegotiable" class="job-card__badge job-card__badge_salary">{{ t("salaryNegotiable") }}</span>
    </div>

    <div v-if="salary || convertedSalary" class="job-card__compensation">
      <div class="job-card__salary-values">
        <span v-if="salary" class="job-card__salary">{{ salary }}</span>
        <span v-if="convertedSalary" class="job-card__salary job-card__salary_conv">{{ convertedSalary }}</span>
      </div>
    </div>

    <div v-if="job.languages?.length" class="job-card__langs text-muted">
      <u-icon name="i-lucide-languages" class="job-card__lang-icon" />
      <span v-for="language in job.languages" :key="language.language" class="job-card__lang">
        {{ language.language }}<template v-if="language.level"> ({{ language.level }})</template>
      </span>
    </div>
    <p v-if="job.description" class="job-card__desc text-muted">{{ job.description }}</p>

    <div class="job-card__footer">
      <template v-if="ats">
        <div v-if="ats.matched.length" class="job-card__skills">
          <span class="job-card__skills-label">{{ t("atsMatched") }}</span>
          <span v-for="keyword in ats.matched" :key="keyword" class="job-card__tag job-card__tag_match">{{ keyword }}</span>
        </div>
        <div v-if="ats.missing.length" class="job-card__skills">
          <span class="job-card__skills-label">{{ t("atsMissing") }}</span>
          <span v-for="keyword in ats.missing" :key="keyword" class="job-card__tag job-card__tag_miss">{{ keyword }}</span>
        </div>
        <div v-if="!ats.matched.length && !ats.missing.length" class="job-card__skills">
          <span class="job-card__skills-label">{{ t("atsNoSkills") }}</span>
        </div>
      </template>
      <div v-else-if="job.skills?.length" class="job-card__tags">
        <span v-for="skill in job.skills.slice(0, 8)" :key="skill" class="job-card__tag job-card__tag_skill">{{ skill }}</span>
        <span v-for="skill in (job.niceToHave || []).slice(0, 4)" :key="'plus-' + skill" class="job-card__tag job-card__tag_plus" :title="t('vNiceToHave')">+{{ skill }}</span>
      </div>
      <div v-else-if="job.tags.length" class="job-card__tags">
        <span v-for="tag in job.tags.slice(0, 6)" :key="tag" class="job-card__tag">{{ tag }}</span>
      </div>
      <button type="button" class="job-card__details-btn" @click="emit('open', job)">
        {{ t("viewVacancy") }} <u-icon name="i-lucide-arrow-right" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.job-card { position: relative; isolation: isolate; overflow: hidden; padding: 18px; border-radius: 14px; border: 1px solid var(--line); background: var(--bg-panel); box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 16px 36px rgba(2,6,23,.12); transition: transform 160ms ease, border-color 180ms ease, box-shadow 180ms ease; height: 100%; min-height: 340px; display: flex; flex-direction: column; }
.job-card_scored { border-color: var(--line); box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 16px 36px rgba(2,6,23,.12); }
.job-card:hover { transform: translateY(-3px); border-color: rgba(224,103,154,.42); box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 20px 42px rgba(2,6,23,.22); }
.job-card_scored:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 20px 42px rgba(2,6,23,.22); }
.job-card__head { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: start; gap: 12px; }
.job-card__title { width: 100%; min-width: 0; overflow-wrap: break-word; font-weight: 700; font-size: 15px; line-height: 1.4; padding: 0; border: 0; background: transparent; cursor: pointer; text-align: left; color: var(--text-white, inherit); }
.job-card__title:hover { color: var(--color-primary, #e0679a); }
.job-card__ats { justify-self: end; white-space: nowrap; font-size: 11px; font-weight: 700; padding: 2px 8px; border: 1px solid; border-radius: 7px; background: rgba(2,6,23,.18); }
.job-card__meta-row { display: flex; align-items: flex-start; gap: 10px; margin-top: 10px; }
.job-card__byline { display: flex; flex: 1 1 auto; min-width: 0; flex-wrap: wrap; align-items: center; gap: 5px; padding-top: 4px; font-size: 12px; line-height: 1.35; }
.job-card__company { font-weight: 600; }
.job-card__dot { opacity: .5; }
.job-card__actions { flex: 0 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: 4px; }
.job-card__action { width: 27px; height: 27px; display: inline-grid; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-panel-2); color: var(--ui-text-muted); cursor: pointer; transition: color 160ms ease, border-color 160ms ease, background 160ms ease; }
.job-card__action :deep(svg) { display: block; margin: auto; }
.job-card__action:hover { color: var(--accent-pink, #e0679a); border-color: rgba(224,103,154,.45); }
.job-card__action_active { color: var(--accent-pink, #e0679a); background: rgba(224,103,154,.12); }
.job-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; }
.job-card__badge { flex: 0 0 auto; white-space: nowrap; border-radius: 6px; padding: 2px 8px; font-size: 11px; line-height: 1.35; color: #34d399; background: rgba(52,211,153,.14); }
.job-card__badge_mode { color: #38bdf8; background: rgba(56,189,248,.14); }
.job-card__badge_visa { color: #fbbf24; background: rgba(251,191,36,.14); }
.job-card__badge_suspicious { color: #f87171; background: rgba(248,113,113,.14); cursor: help; }
.job-card__badge_reloc { color: #f472b6; background: rgba(244,114,182,.14); }
.job-card__badge_source { color: #c4b5fd; background: rgba(167,139,250,.14); }
.job-card__badge_new { color: #6ee7b7; background: rgba(52,211,153,.14); }
.job-card__badge_seen { color: #94a3b8; background: rgba(148,163,184,.14); }
.job-card__badge_employment { color: #93c5fd; background: rgba(59,130,246,.13); }
.job-card__badge_seniority { color: #f9a8d4; background: rgba(236,72,153,.13); }
.job-card__badge_management { color: #fcd34d; background: rgba(245,158,11,.13); }
.job-card__badge_salary { color: #f0abfc; background: rgba(217,70,239,.12); }
.job-card__compensation { min-width: 0; margin-top: 12px; }
.job-card__salary-values { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.job-card__salary { color: #f08ab8; font-size: 15px; line-height: 1.3; font-weight: 750; letter-spacing: .01em; overflow-wrap: anywhere; }
.job-card__salary_conv { color: var(--ui-text-muted); font-size: 12px; font-weight: 550; opacity: .9; }
.job-card__langs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; }
.job-card__lang-icon { font-size: 14px; opacity: .7; }
.job-card__lang:not(:last-child)::after { content: ","; }
.job-card__desc { margin-top: 10px; font-size: 13px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.job-card__footer { display: flex; flex-direction: column; margin-top: auto; padding-top: 12px; }
.job-card__tags, .job-card__skills { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.job-card__skills + .job-card__skills { margin-top: 9px; }
.job-card__skills-label { flex-basis: 100%; font-size: 11px; line-height: 1.3; opacity: .72; }
.job-card__tag { border-radius: 6px; padding: 3px 8px; font-size: 11px; line-height: 1.3; border: 1px solid var(--line); color: var(--ui-text-muted); }
.job-card__tag_skill { border-color: rgba(224,103,154,.3); color: #e79ec0; }
.job-card__tag_plus { border-color: rgba(52,211,153,.35); color: #6ee7b7; }
.job-card__tag_match { border-color: rgba(52,211,153,.45); color: #34d399; background: rgba(52,211,153,.1); }
.job-card__tag_miss { border-color: rgba(248,113,113,.4); color: #f87171; }
.job-card__details-btn { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; margin-top: 14px; padding: 0; background: none; border: none; color: var(--accent-pink, #e0679a); font-size: 12px; font-weight: 700; cursor: pointer; }
.job-card__details-btn :deep(svg) { transition: transform 160ms ease; }
.job-card__details-btn:hover { text-decoration: underline; }
.job-card__details-btn:hover :deep(svg) { transform: translateX(3px); }
.job-card_seen { opacity: .72; }
.job-card_seen:hover { opacity: 1; }
.job-card_favorite { border-color: rgba(224,103,154,.48); }
.job-card_hidden { opacity: .62; border-style: dashed; }
@media (max-width: 480px) {
  .job-card { min-height: 0; padding: 15px; }
  .job-card__head { grid-template-columns: 1fr; gap: 8px; }
  .job-card__ats { justify-self: start; }
  .job-card__meta-row { flex-direction: column; }
  .job-card__actions { order: -1; align-self: flex-end; margin-bottom: -30px; }
  .job-card__byline { padding-right: 124px; }
}
</style>
