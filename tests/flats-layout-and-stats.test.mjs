import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const card = await readFile(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
const grid = await readFile(new URL('../app/components/search/SearchResultGrid.vue', import.meta.url), 'utf8')
const stats = await readFile(new URL('../app/components/flats/StatsPanel.vue', import.meta.url), 'utf8')
const feed = await readFile(new URL('../app/composables/flats/useFlatFeed.ts', import.meta.url), 'utf8')
const presentation = await readFile(new URL('../app/composables/flats/useFlatPresentation.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/[...slug].vue', import.meta.url), 'utf8')
const locations = await readFile(new URL('../app/utils/locationLabels.ts', import.meta.url), 'utf8')
const flatFilters = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8')
const jobFilters = await readFile(new URL('../app/composables/jobs/useJobFilters.ts', import.meta.url), 'utf8')
const hiringFilters = await readFile(new URL('../app/composables/hiring/useHiringFilters.ts', import.meta.url), 'utf8')
const jobStats = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
const jobPage = await readFile(new URL('../app/pages/jobs/index.vue', import.meta.url), 'utf8')
const hiringPage = await readFile(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
const advancedFilters = await readFile(new URL('../app/components/search/SearchAdvancedFilters.vue', import.meta.url), 'utf8')
const advancedToggle = await readFile(new URL('../app/components/search/SearchAdvancedToggle.vue', import.meta.url), 'utf8')
const resultsLoader = await readFile(new URL('../app/components/ui/ResultsLoader.vue', import.meta.url), 'utf8')

test('flat cards stay equal within a row and use the target compact desktop/mobile geometry', () => {
  assert.match(grid, /align-items: stretch/u)
  assert.doesNotMatch(page, /<SearchResultGrid[^>]*\bequal-rows\b/u)
  // Breakpoints go through the shared bp-* mixins now, so assert the token the
  // grid widens at rather than the media query the mixin expands to.
  assert.match(grid, /@include bp-up\(xxl\)[^}]*repeat\(4, minmax\(0, 1fr\)\)/u)
  assert.doesNotMatch(grid, /repeat\(5, minmax\(0, 1fr\)\)/u)
  assert.match(card, /\.flat-card \{[^}]*height: 100%/u)
  assert.match(card, /\.flat-card__photo \{[^}]*aspect-ratio: 1\.5[^}]*overflow: hidden/u)
  assert.match(card, /\.flat-card__photo > img \{[^}]*height: 100%[^}]*object-fit: cover/u)
  assert.match(card, /@include bp-down\(md\)[\s\S]*?height: 148px; min-height: 148px/u)
  assert.match(card, /grid-template-columns: minmax\(112px, 42%\) minmax\(0, 1fr\)/u)
  assert.match(card, /:title="presentation\.title"/u)
  assert.match(card, /-webkit-line-clamp: 1/u)
  assert.doesNotMatch(card, /\.flat-card__meta \{[^}]*border-top/u)
})

test('flat card footer shows only city and district, without metro duplication', () => {
  assert.match(presentation, /const cardLocation = \[\.\.\.new Set\(\[/u)
  assert.match(presentation, /locName\(listing\.city, "city", listing\)/u)
  assert.match(presentation, /locName\(listing\.district, "district", listing\)/u)
  assert.doesNotMatch(presentation, /cardLocation[\s\S]{0,220}listing\.metro/u)
  assert.match(presentation, /location: cardLocation/u)
})

test('flat card context badge follows ownership and geography filters', () => {
  assert.match(presentation, /function contextualBadgeLabel\(listing: FlatListing\)/u)
  assert.match(presentation, /options\.getAgency\(\) === "any"/u)
  assert.match(presentation, /return listing\.byAgency \? t\("badgeAgency"\) : t\("badgeOwner"\)/u)
  assert.match(presentation, /if \(hasFineGeoFilter\(\)\) return rooms/u)
  assert.match(presentation, /route\.query\.microdistrict/u)
  assert.match(presentation, /route\.query\.residenceComplex/u)
  assert.match(presentation, /if \(selectedDistrict\(\)\)[\s\S]*?return metro \|\| microdistrict \|\| residenceComplex \|\| rooms/u)
  assert.match(presentation, /return locName\(listing\.district, "district", listing\) \|\| metro \|\| microdistrict \|\| residenceComplex \|\| rooms/u)
})

test('good price badge consumes the database market comparison and stays pinned to the photo corner', () => {
  assert.ok(feed.includes('const listings = ref<FlatListing[]>([])'))
  assert.doesNotMatch(feed, /flat-finder:listings/u)
  assert.match(presentation, /listing\.marketComparison\?\.goodPrice === true/u)
  assert.match(presentation, /listing\.marketComparison\?\.medianUsd \?\? null/u)
  assert.match(presentation, /listing\.marketComparison\?\.comparableCount \?\? 0/u)
  assert.doesNotMatch(presentation, /PERCENTILE_CONT|comparisonListings|dealComparisonKey|areaTolerance/u)
  assert.match(card, /v-if="presentation\.goodPrice" class="flat-card__good-price"/u)
  assert.match(card, /\.flat-card__good-price \{[^}]*left: 9px; bottom: 9px/u)
})

test('flat geography statistics stay populated when a scoped country slice is empty', () => {
  assert.match(stats, /geographiesByDeal\?\.\[dealScope\.value\]/u)
  assert.match(stats, /scoped\?\.length \? scoped : \(props\.statistics\.geographies\[geoDimension\.value\]/u)
  for (const kind of ['sale', 'longRent', 'shortRent', 'roomRent']) assert.match(stats, new RegExp(`"${kind}"`, 'u'))
  assert.match(stats, /<SearchSourceTabs v-model="dealScope"/u)
})

test('selected city breaks statistics down by district and a price line shows listings per price', () => {
  assert.match(stats, /selectedCity\?: string/u)
  assert.match(stats, /geoDimension\.value = city \? "district" : "city"/u)
  assert.match(stats, /priceDistributionByDeal\?\.\[dealScope\.value\]/u)
  assert.match(stats, /<LazyUiAnalyticsLine :series="priceDistribution\.series" :labels="priceDistribution\.labels" \/>/u)
  assert.match(page, /<FlatsStatsPanel[^>]*:selected-city="city"/u)
})

test('location geography delegates exact and cross-kind rendering to the shared geography package', () => {
  assert.match(locations, /LocationKind = 'country' \| 'city' \| 'district' \| 'metro' \| 'any'/u)
  assert.match(locations, /@whiteslove\/parsing-lexicon\/geography-display/u)
  assert.match(locations, /const exact = geographyDisplayName\(value, locale, kind\)/u)
  assert.match(locations, /\? geographyDisplayName\(value, locale, 'any'\)/u)
  assert.doesNotMatch(locations, /countryDisplayLabel|DISTRICT_RU|METRO_RU|METRO_ALIAS_RU/u)
})

test('flat statistics are not cleared while a country refresh waits for the background aggregate', () => {
  assert.match(feed, /if \(!append && data\.statistics\)\s*\{\s*void setStatisticsWithoutViewportJump\(data\.statistics\);?\s*\}/u)
  assert.doesNotMatch(feed, /statistics\.value = data\.statistics \|\| null/u)
  assert.match(feed, /const statisticsLoading = ref\(false\)/u)
})

test('advanced filters share one collapsed shell on all three search boards', () => {
  assert.match(flatFilters, /const showAdvanced = ref\(false\)/u)
  assert.match(jobFilters, /const showAdvanced = ref\(false\)/u)
  assert.match(hiringFilters, /const showAdvanced = ref\(false\)/u)
  assert.match(page, /<SearchAdvancedFilters v-model="showAdvanced"/u)
  assert.match(jobPage, /<SearchAdvancedFilters v-model="showAdvanced"/u)
  assert.match(hiringPage, /<SearchAdvancedFilters v-model="showAdvanced" :label="t\('advanced'\)" :hide-label="t\('hideFilters'\)"/u)
  assert.match(advancedFilters, /const open = defineModel<boolean>\(\{ default: false \}\)/u)
  assert.match(advancedFilters, /<SearchAdvancedToggle v-model="open"/u)
  assert.match(advancedToggle, /:aria-expanded="open"/u)
  assert.match(advancedToggle, /:name="open \? 'i-lucide-chevron-up' : 'i-lucide-chevron-right'"/u)
  assert.doesNotMatch(advancedFilters, /search-advanced-filters__toggle_open/u)
  assert.doesNotMatch(jobPage, /showAdvanced = !showAdvanced/u)
  assert.doesNotMatch(hiringPage, /v-if="showAdvanced" class="hiring__advanced"/u)
  assert.doesNotMatch(page, /advanced-card|advanced-button|toggleAdvanced/u)
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

test('flat finder layout does not shift after hydration', () => {
  // The toggle is rendered in place by the page, not teleported after mount by
  // a component that sniffs the route.
  assert.doesNotMatch(advancedFilters, /teleport|useRoute/iu)
  assert.match(page, /<SearchAdvancedFilters v-model="showAdvanced" external-toggle/u)
  assert.match(page, /<UiFilterFooter[^>]*>\s*<SearchAdvancedToggle v-model="showAdvanced"/u)
  // The price slider's cell exists before the bounds arrive.
  assert.match(page, /<div class="filter-price-row__slider">\s*<UiRangeSlider\s+v-if="priceRange"/u)
  assert.match(page, /\.filter-price-row__slider \{[^}]*height: 40px/u)
  // Client-only map and late statistics keep their space from SSR on.
  assert.match(page, /\.flats__map-wrap \{[^}]*min-height: 420px/u)
  assert.match(page, /<div v-if="view === 'active' && !failed" class="flats__stats-slot">/u)
  // SSR has no listings: it must render "loading", never "nothing found".
  assert.match(feed, /const loading = ref\(true\)/u)
  assert.match(page, /<UiResultsLoader :loading="loading" :label="t\('searching'\)" min-height="100vh">/u)
  assert.match(resultsLoader, /position: sticky/u)
})

test('flat statistics charts are lazy so chart.js stays out of the page bundle', () => {
  assert.doesNotMatch(stats, /<UiAnalytics(Line|Bars|Donut|Bubble)\b/u)
  assert.match(stats, /<LazyUiAnalyticsBars\b/u)
})

test('flat-finder renders real listings in the server HTML for crawlers', async () => {
  const latest = await readFile(new URL('../app/components/flats/LatestListings.vue', import.meta.url), 'utf8')
  assert.match(latest, /useAsyncData\("flat-finder-latest-listings"[\s\S]*server: true/u)
  assert.match(page, /<FlatsLatestListings v-if="routeSlug\(\)\.length === 0" \/>/u)
})
