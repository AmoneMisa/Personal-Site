<script setup lang="ts">
import type { HiringCvProfile } from '~/types/hiring'
import { formatRelativeDate } from '~/utils/search/relativeDate'
import SearchMatchBadge from '~/components/search/SearchMatchBadge.vue'
import { locationLabel } from '~/utils/locationLabels'
import {
  scoreHiringCandidate,
  tagMatchesHiringFilters,
  type HiringMatchFilters,
} from '~/utils/hiringMatch'

const props = withDefaults(defineProps<{
  profile: HiringCvProfile
  favorite?: boolean
  hidden?: boolean
  rates?: Record<string, number>
  countryCurrency?: string
  matchFilters: HiringMatchFilters
}>(), {
  favorite: false,
  hidden: false,
  rates: () => ({ USD: 1 }),
  countryCurrency: '',
})

const emit = defineEmits<{
  open: []
  toggleFavorite: []
  toggleHidden: []
}>()

const { t: translate, locale } = useI18n()
const t = (key: string, params: Record<string, unknown> = {}) => translate(`hiring.${key}`, params)

const match = computed(() => scoreHiringCandidate(props.profile, props.matchFilters))
const matchTier = computed(() => {
  if (!match.value) return null
  if (match.value.score >= 75) return 'high'
  if (match.value.score >= 50) return 'medium'
  return 'low'
})
const cardClasses = computed(() => ({
  'hiring-card_favorite': props.favorite,
  'hiring-card_hidden': props.hidden,
  [`hiring-card_match-${matchTier.value}`]: !!matchTier.value,
}))

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

function formatNumber(value: number): string {
  return new Intl.NumberFormat(String(locale.value), { maximumFractionDigits: 0 }).format(value)
}

function convertedAmount(amount: number, from: string, to: string): number | undefined {
  if (from === to) return amount
  const fromRate = props.rates[from]
  const toRate = props.rates[to]
  if (!fromRate || !toRate) return undefined
  return Math.round((amount * fromRate) / toRate)
}

function salaryForCurrency(currency: string, approximate: boolean): string | null {
  const source = String(props.profile.currency || '').toUpperCase()
  const min = props.profile.salaryMin == null
    ? undefined
    : approximate ? convertedAmount(props.profile.salaryMin, source, currency) : props.profile.salaryMin
  const max = props.profile.salaryMax == null
    ? undefined
    : approximate ? convertedAmount(props.profile.salaryMax, source, currency) : props.profile.salaryMax
  if (min == null && max == null) return null

  const body = min != null && max != null && min !== max
    ? `${formatNumber(min)}–${formatNumber(max)}`
    : formatNumber((min ?? max)!)
  const symbol = CURRENCY_SYMBOL[currency]
  const money = symbol ? `${symbol}${body}` : `${body} ${currency}`.trim()
  return approximate ? `≈ ${money}` : money
}

const salaryAmounts = computed(() => {
  if (props.profile.salaryMin == null && props.profile.salaryMax == null) return []
  const source = String(props.profile.currency || '').toUpperCase()
  if (!source) {
    const raw = salaryForCurrency('', false)
    return raw ? [{ currency: '', label: raw }] : []
  }
  const targets = [...new Set([
    source,
    String(props.countryCurrency || '').toUpperCase(),
    'USD',
  ].filter(Boolean))].slice(0, 3)

  return targets.flatMap((currency, index) => {
    const value = salaryForCurrency(currency, index > 0)
    return value ? [{ currency, label: value }] : []
  }).slice(0, 3)
})

function experienceLabel(years: number): string {
  if (years === 0) return t('experienceNone')
  const value = new Intl.NumberFormat(String(locale.value), { maximumFractionDigits: 1 }).format(years)
  return t('experienceN', { n: value })
}

const metadata = computed(() => {
  const items: Array<{ key: string, icon: string, value: string, title: string }> = []
  if (props.profile.age != null) {
    items.push({ key: 'age', icon: 'i-lucide-user-round', value: String(props.profile.age), title: `${t('age')}: ${props.profile.age}` })
  }
  if (props.profile.experienceYears != null) {
    const value = experienceLabel(props.profile.experienceYears)
    items.push({ key: 'experience', icon: 'i-lucide-briefcase-business', value, title: `${t('specExperience')}: ${value}` })
  }
  if (props.profile.city) {
    items.push({
      key: 'city',
      icon: 'i-lucide-map-pin',
      value: locationLabel(props.profile.city, String(locale.value), 'city'),
      title: t('filterLocation'),
    })
  }
  if (props.profile.remote) {
    items.push({ key: 'remote', icon: 'i-lucide-laptop', value: t('remoteBadge'), title: t('remoteBadge') })
  }
  return items
})

function tagKey(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim()
}

const cardTags = computed(() => {
  const result: string[] = []
  const seen = new Set<string>()
  const values = [...(props.profile.skills || []), ...(props.profile.tags || [])]
  for (const value of values) {
    const trimmed = String(value || '').trim()
    const key = tagKey(trimmed)
    if (!trimmed || seen.has(key) || /^(?:age|возраст|district|район)\s*:/iu.test(trimmed)) continue
    seen.add(key)
    result.push(trimmed)
    if (result.length === 6) break
  }
  return result
})

function timeAgo(iso: string | null): string {
  return formatRelativeDate(iso, {
    today: () => t('today'),
    yesterday: () => t('yesterday'),
    daysAgo: (n) => t('daysAgo', { n }),
    monthsAgo: (n) => t('monthsAgo', { n }),
  })
}

const sourceLabel = computed(() => props.profile.sourceLabel || props.profile.source)
const dateLabel = computed(() => timeAgo(props.profile.createdAt))

function openCard() {
  emit('open')
}
</script>

<template>
  <article
    class="hiring-card"
    :class="cardClasses"
    role="button"
    tabindex="0"
    @click="openCard"
    @keydown.enter.self="openCard"
    @keydown.space.prevent.self="openCard"
  >
    <div class="hiring-card__actions">
      <button
        type="button"
        class="hiring-card__action"
        :class="{ 'hiring-card__action_active': favorite }"
        :aria-label="favorite ? t('removeFavorite') : t('addFavorite')"
        :title="favorite ? t('removeFavorite') : t('addFavorite')"
        @click.stop="emit('toggleFavorite')"
      >
        <u-icon name="i-lucide-heart" />
      </button>
      <button
        type="button"
        class="hiring-card__action"
        :class="{ 'hiring-card__action_active': hidden }"
        :aria-label="hidden ? t('restoreListing') : t('hideListing')"
        :title="hidden ? t('restoreListing') : t('hideListing')"
        @click.stop="emit('toggleHidden')"
      >
        <u-icon :name="hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'" />
      </button>
    </div>

    <header class="hiring-card__header">
      <h3 class="hiring-card__title">{{ profile.name || profile.role }}</h3>
      <p v-if="profile.name && profile.role" class="hiring-card__role">{{ profile.role }}</p>
    </header>

    <div v-if="salaryAmounts.length" class="hiring-card__salary" :title="salaryAmounts.map((item) => item.label).join(' · ')">
      <span v-for="item in salaryAmounts" :key="item.currency || item.label" class="hiring-card__salary-item">
        {{ item.label }}
      </span>
    </div>

    <div v-if="metadata.length" class="hiring-card__metadata">
      <span v-for="item in metadata" :key="item.key" class="hiring-card__metadata-item" :title="item.title">
        <u-icon :name="item.icon" aria-hidden="true" />
        <span>{{ item.value }}</span>
      </span>
    </div>

    <div v-if="cardTags.length" class="hiring-card__tags">
      <span
        v-for="tag in cardTags"
        :key="tag"
        class="hiring-card__tag"
        :class="{ 'hiring-card__tag_matched': tagMatchesHiringFilters(tag, match) }"
      >{{ tag }}</span>
    </div>

    <footer class="hiring-card__footer">
      <div class="hiring-card__provenance">
        <span v-if="sourceLabel" class="hiring-card__source" :title="t('specSource')">
          <u-icon name="i-lucide-database" aria-hidden="true" />
          <span>{{ sourceLabel }}</span>
        </span>
        <span v-if="dateLabel" class="hiring-card__date">
          <u-icon name="i-lucide-calendar-days" aria-hidden="true" />
          <span>{{ dateLabel }}</span>
        </span>
      </div>
      <SearchMatchBadge
        v-if="match"
        class="hiring-card__match"
        :value="match.score"
        :tier="match.score >= 75 ? 'good' : match.score >= 50 ? 'warning' : 'bad'"
        :suffix="`% ${t('match')}`"
        :title="t('matchHint', { matched: match.matched, total: match.total })"
      />
    </footer>
  </article>
</template>

<style scoped>
.hiring-card {
  --money-color: #f1a6c6;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 226px;
  height: 100%;
  padding: 15px 16px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-panel);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
  cursor: pointer;
  transition: transform 140ms ease, border-color 180ms ease, box-shadow 180ms ease;
}
.hiring-card:hover,
.hiring-card:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(113, 137, 217, 0.48);
  outline: none;
}
.hiring-card_match-high {
  --match-color: #34d399;
  --match-border: rgba(52, 211, 153, 0.72);
  --match-soft: rgba(52, 211, 153, 0.10);
  --match-soft-border: rgba(52, 211, 153, 0.34);
  border-color: var(--match-border);
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.07);
}
.hiring-card_match-medium {
  --match-color: #fbbf24;
  --match-border: rgba(251, 191, 36, 0.72);
  --match-soft: rgba(251, 191, 36, 0.10);
  --match-soft-border: rgba(251, 191, 36, 0.34);
  border-color: var(--match-border);
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.07);
}
.hiring-card_match-low {
  --match-color: #fb7a45;
  --match-border: rgba(251, 122, 69, 0.72);
  --match-soft: rgba(251, 122, 69, 0.10);
  --match-soft-border: rgba(251, 122, 69, 0.34);
  border-color: var(--match-border);
  box-shadow: inset 0 0 0 1px rgba(251, 122, 69, 0.07);
}
.hiring-card_match-high:hover,
.hiring-card_match-high:focus-visible,
.hiring-card_match-medium:hover,
.hiring-card_match-medium:focus-visible,
.hiring-card_match-low:hover,
.hiring-card_match-low:focus-visible {
  border-color: var(--match-color);
  box-shadow: inset 0 0 0 1px var(--match-soft-border), 0 8px 22px rgba(0, 0, 0, 0.14);
}
.hiring-card_favorite:not(.hiring-card_match-high):not(.hiring-card_match-medium):not(.hiring-card_match-low) {
  border-color: rgba(113, 137, 217, 0.52);
}
.hiring-card_hidden {
  opacity: 0.64;
  border-style: dashed;
}
.hiring-card__actions {
  position: absolute;
  top: 11px;
  right: 11px;
  z-index: 1;
  display: flex;
  gap: 5px;
}
.hiring-card__action {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-panel-2);
  color: var(--text-muted);
  cursor: pointer;
}
.hiring-card__action :deep(svg) { display: block; margin: auto; }
.hiring-card__action:hover,
.hiring-card__action_active {
  color: #7189d9;
  border-color: rgba(113, 137, 217, 0.5);
  background: rgba(113, 137, 217, 0.10);
}
.hiring-card__header {
  min-width: 0;
  padding-right: 72px;
}
.hiring-card__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hiring-card__role {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.hiring-card__salary {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  margin-top: 9px;
  color: var(--money-color);
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.35;
}
.hiring-card__salary-item {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.hiring-card__salary-item + .hiring-card__salary-item::before {
  content: '·';
  margin-right: 6px;
  color: rgba(241, 166, 198, 0.56);
}
.hiring-card__metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 9px;
  color: var(--ui-text-muted);
  font-size: 11.5px;
}
.hiring-card__metadata-item,
.hiring-card__source,
.hiring-card__date {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}
.hiring-card__metadata-item :deep(svg),
.hiring-card__source :deep(svg),
.hiring-card__date :deep(svg) {
  flex: 0 0 auto;
  font-size: 13px;
  opacity: 0.78;
}
.hiring-card__tags {
  display: flex;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 53px;
  margin-top: 10px;
  overflow: hidden;
}
.hiring-card__tag {
  max-width: 100%;
  padding: 3px 8px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text-primary);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hiring-card__tag_matched {
  border-color: var(--match-soft-border);
  background: var(--match-soft);
  color: var(--match-color);
}
.hiring-card__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  margin-top: auto;
  padding-top: 12px;
}
.hiring-card__provenance {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--ui-text-muted);
  font-size: 10.75px;
}
.hiring-card__source span,
.hiring-card__date span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hiring-card__match {
  flex: 0 0 auto;
  padding: 2px 7px;
  border: 1px solid var(--match-soft-border);
  border-radius: 6px;
  background: var(--match-soft);
  color: var(--match-color);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .hiring-card {
    min-height: 218px;
    padding: 14px;
  }
  .hiring-card__actions {
    top: 10px;
    right: 10px;
  }
  .hiring-card__footer {
    align-items: center;
  }
}
</style>
