import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const card = await readFile(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
const grid = await readFile(new URL('../app/components/flats/FlatGrid.vue', import.meta.url), 'utf8')
const stats = await readFile(new URL('../app/components/flats/StatsPanel.vue', import.meta.url), 'utf8')
const feed = await readFile(new URL('../app/composables/flats/useFlatFeed.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
const locations = await readFile(new URL('../app/utils/locationLabels.ts', import.meta.url), 'utf8')
const flatFilters = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8')
const jobFilters = await readFile(new URL('../app/composables/jobs/useJobFilters.ts', import.meta.url), 'utf8')
const hiringFilters = await readFile(new URL('../app/composables/hiring/useHiringFilters.ts', import.meta.url), 'utf8')
const jobStats = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')

test('flat cards share one row height and compact title/media geometry', () => {
  assert.match(grid, /align-items: stretch; grid-auto-rows: 1fr/u)
  assert.match(card, /\.flat-card \{[^}]*height: 100%/u)
  assert.match(card, /\.flat-card__photo \{[^}]*aspect-ratio: 16 \/ 9/u)
  assert.match(card, /:title="presentation\.title"/u)
  assert.match(card, /-webkit-line-clamp: 1/u)
  assert.doesNotMatch(card, /\.flat-card__meta \{[^}]*border-top/u)
})

test('flat geography statistics stay populated when a scoped country slice is empty', () => {
  assert.match(stats, /geographiesByDeal\?\.\[dealScope\.value\]/u)
  assert.match(stats, /scoped\?\.length \? scoped : \(props\.statistics\.geographies\[geoDimension\.value\]/u)
  for (const kind of ['sale', 'longRent', 'shortRent', 'roomRent']) assert.match(stats, new RegExp(`"${kind}"`, 'u'))
  assert.match(stats, /<SearchSourceTabs v-model="dealScope"/u)
})

test('country geography is a supported display kind instead of crashing the analytics render', () => {
  assert.match(locations, /LocationKind = 'country' \| 'city' \| 'district' \| 'metro' \| 'any'/u)
  assert.match(locations, /if \(kind === 'country'\) return countryDisplayLabel\(value, locale\)/u)
  assert.match(locations, /new Intl\.DisplayNames\(\[locale \|\| 'en'\], \{ type: 'region' \}\)/u)
})

test('flat statistics are not cleared while a country refresh waits for the background aggregate', () => {
  assert.match(feed, /if \(!append && data\.statistics\) statistics\.value = data\.statistics/u)
  assert.doesNotMatch(feed, /statistics\.value = data\.statistics \|\| null/u)
  assert.match(feed, /const statisticsLoading = ref\(false\)/u)
})

test('advanced filters are collapsed by default on all three search boards', () => {
  assert.match(flatFilters, /const showAdvanced = ref\(false\)/u)
  assert.match(jobFilters, /const showAdvanced = ref\(false\)/u)
  assert.match(hiringFilters, /const showAdvanced = ref\(false\)/u)
})

test('vacancy graphs do not render the redundant sparse salary line', () => {
  assert.doesNotMatch(jobStats, /const salaryTrend = computed/u)
  assert.doesNotMatch(jobStats, /analytics-card__head/u)
  assert.match(jobStats, /professionSalaryBars/u)
  assert.match(jobStats, /<UiAnalyticsBars :items="professionSalaryBars" :format="money"/u)
})

test('room rent remains a deal type but is not duplicated in quick filters', () => {
  assert.match(page, /t\("dtRoomRent"\), value: "roomRent"/u)
  assert.doesNotMatch(page, /icon="i-lucide-bed-single"/u)
})
