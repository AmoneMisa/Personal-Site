import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const panel = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
const chart = await readFile(new URL('../app/components/ui/AnalyticsLine.vue', import.meta.url), 'utf8')
const tabs = await readFile(new URL('../app/components/ui/AnalyticsTabs.vue', import.meta.url), 'utf8')
const shell = await readFile(new URL('../app/components/ui/AnalyticsPanel.vue', import.meta.url), 'utf8')

test('vacancy trends render through the shared Chart.js line component', () => {
  assert.match(chart, /from "chart\.js"/u)
  assert.match(chart, /from "vue-chartjs"/u)
  assert.match(panel, /<UiAnalyticsLine surface/u)
  assert.match(chart, /analytics-line_surface/u)
})

test('vacancy analytics has one designed data-versus-graphs tab switch', () => {
  assert.equal((panel.match(/<UiAnalyticsTabs/gu) || []).length, 1)
  assert.match(panel, /<USelectMenu[\s\S]*:model-value="String\(trendDays\)"/u)
  assert.match(panel, /<USelectMenu[\s\S]*:model-value="trendScope"/u)
  assert.match(tabs, /role="tablist"/u)
  assert.doesNotMatch(tabs, /compact/u)
  assert.match(tabs, /linear-gradient\(135deg, rgba\(224, 103, 154/u)
})

test('analytics panel header is clickable outside its nested controls', () => {
  assert.match(shell, /class="analytics-panel__head-toggle"/u)
  assert.match(shell, /@click="toggleExpanded"/u)
  assert.match(shell, /:aria-label="expanded \? collapseLabel : expandLabel"/u)
  assert.match(shell, /@click\.stop="toggleExpanded"/u)
})

test('Russian salary period labels are compact in vacancy statistics', () => {
  assert.match(panel, /normalized === "год"\) return "г\."/u)
  assert.match(panel, /normalized === "месяц"\) return "м\."/u)
  assert.match(panel, /\{\{\s*displayCurrency\s*\}\}\s*\/\s*\{\{\s*compactDisplayPeriodLabel\s*\}\}/u)
})
