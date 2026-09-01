import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('hiring UI consumes server statistics instead of page-only sampling', () => {
  const feed = readFileSync(new URL('../app/composables/hiring/useHiringFeed.ts', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../app/components/hiring/StatsPanel.vue', import.meta.url), 'utf8')

  assert.match(feed, /statistics\.value = data\.statistics \|\| null/u)
  assert.match(panel, /props\.statistics \|\| localStatistics\.value/u)
  assert.match(panel, /experienceSalaryBars/u)
  assert.match(panel, /<UiAnalyticsBars v-if="experienceSalaryBars\.length" :items="experienceSalaryBars"/u)
  assert.match(panel, /statsNoSalaryData/u)
})

test('hiring and flats share one UA/UZ regional default without selecting every country', () => {
  const helper = readFileSync(new URL('../app/utils/search/regionalCountry.ts', import.meta.url), 'utf8')
  const hiringMeta = readFileSync(new URL('../app/composables/hiring/useHiringMeta.ts', import.meta.url), 'utf8')
  const hiringPage = readFileSync(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
  const flatPage = readFileSync(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')

  assert.match(helper, /timeZone\.startsWith\("Asia\/"\) \? "UZ" : "UA"/u)
  assert.doesNotMatch(hiringMeta, /data\.map\(\(country\) => country\.code\)/u)
  assert.match(hiringPage, /regionalSearchCountry/u)
  assert.match(flatPage, /regionalSearchCountry/u)
})
