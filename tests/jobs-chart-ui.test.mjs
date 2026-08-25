import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const panel = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
const chart = await readFile(new URL('../app/components/ui/AnalyticsLine.vue', import.meta.url), 'utf8')
const tabs = await readFile(new URL('../app/components/ui/AnalyticsTabs.vue', import.meta.url), 'utf8')

test('vacancy trends render through the shared Chart.js line component', () => {
  assert.match(chart, /from "chart\.js"/u)
  assert.match(chart, /from "vue-chartjs"/u)
  assert.match(panel, /<UiAnalyticsLine surface/u)
  assert.match(chart, /analytics-line_surface/u)
})

test('vacancy statistics use the shared designed analytics tabs', () => {
  assert.doesNotMatch(panel, /<SearchSourceTabs/u)
  assert.match(panel, /<UiAnalyticsTabs/u)
  assert.match(tabs, /role="tablist"/u)
  assert.match(tabs, /linear-gradient\(135deg, rgba\(224, 103, 154/u)
})

test('Russian salary period labels are compact in vacancy statistics', () => {
  assert.match(panel, /normalized === "год"\) return "г\."/u)
  assert.match(panel, /normalized === "месяц"\) return "м\."/u)
  assert.match(panel, /displayCurrency\}\}\/\{\{ compactDisplayPeriodLabel/u)
})
