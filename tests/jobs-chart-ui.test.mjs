import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const panel = await readFile(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
const line = await readFile(new URL('../app/components/ui/AnalyticsLine.vue', import.meta.url), 'utf8')
const bars = await readFile(new URL('../app/components/ui/AnalyticsBars.vue', import.meta.url), 'utf8')
const donut = await readFile(new URL('../app/components/ui/AnalyticsDonut.vue', import.meta.url), 'utf8')
const tabs = await readFile(new URL('../app/components/ui/AnalyticsTabs.vue', import.meta.url), 'utf8')
const shell = await readFile(new URL('../app/components/ui/AnalyticsPanel.vue', import.meta.url), 'utf8')
const checkbox = await readFile(new URL('../app/components/common/CustomCheckbox.vue', import.meta.url), 'utf8')
const filterControl = await readFile(new URL('../app/components/search/SearchFilterControl.vue', import.meta.url), 'utf8')

test('vacancy graph view uses the same shared Chart.js visualizations as other analytics without the redundant salary line', () => {
  assert.match(line, /from "chart\.js"/u)
  assert.match(line, /from "vue-chartjs"/u)
  assert.match(bars, /from "chart\.js"/u)
  assert.match(bars, /from "vue-chartjs"/u)
  assert.match(donut, /from "chart\.js"/u)
  assert.match(donut, /from "vue-chartjs"/u)
  assert.doesNotMatch(panel, /<UiAnalyticsLine surface/u)
  assert.match(panel, /<UiAnalyticsBars/u)
  assert.match(panel, /<UiAnalyticsDonut/u)
  assert.match(panel, /professionSalaryBars/u)
  assert.doesNotMatch(panel, /<USelectMenu/u)
})

test('vacancy analytics has exactly one designed data-versus-graphs tab switch', () => {
  assert.equal((panel.match(/<UiAnalyticsTabs/gu) || []).length, 1)
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

test('boolean search controls use toggle switches without changing ordinary checkboxes elsewhere', () => {
  assert.match(filterControl, /variant="switch"/u)
  assert.match(checkbox, /variant\?: "checkbox" \| "switch"/u)
  assert.match(checkbox, /:role="variant === 'switch' \? 'switch' : undefined"/u)
  assert.match(checkbox, /class="cb__switch"/u)
  assert.match(checkbox, /class="cb__box"/u)
  assert.match(checkbox, /translateX\(14px\)/u)
})

test('Russian salary period labels are compact in vacancy statistics', () => {
  assert.match(panel, /normalized === "год"\) return "г\."/u)
  assert.match(panel, /normalized === "месяц"\) return "м\."/u)
  assert.match(panel, /\{\{\s*displayCurrency\s*\}\}\s*\/\s*\{\{\s*compactDisplayPeriodLabel\s*\}\}/u)
})
