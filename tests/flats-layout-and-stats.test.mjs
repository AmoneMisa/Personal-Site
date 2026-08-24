import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const card = await readFile(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
const grid = await readFile(new URL('../app/components/flats/FlatGrid.vue', import.meta.url), 'utf8')
const stats = await readFile(new URL('../app/components/flats/StatsPanel.vue', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')

test('flat cards share one row height and compact title/media geometry', () => {
  assert.match(grid, /align-items: stretch; grid-auto-rows: 1fr/u)
  assert.match(card, /\.flat-card \{[^}]*height: 100%/u)
  assert.match(card, /\.flat-card__photo \{[^}]*aspect-ratio: 16 \/ 9/u)
  assert.match(card, /:title="presentation\.title"/u)
  assert.match(card, /-webkit-line-clamp: 1/u)
  assert.doesNotMatch(card, /\.flat-card__meta \{[^}]*border-top/u)
})

test('flat geography statistics can be scoped independently by deal kind', () => {
  assert.match(stats, /geographiesByDeal\?\.\[dealScope\.value\]/u)
  for (const kind of ['sale', 'longRent', 'shortRent', 'roomRent']) assert.match(stats, new RegExp(`"${kind}"`, 'u'))
  assert.match(stats, /<SearchSourceTabs v-model="dealScope"/u)
})

test('room rent remains a deal type but is not duplicated in quick filters', () => {
  assert.match(page, /t\("dtRoomRent"\), value: "roomRent"/u)
  assert.doesNotMatch(page, /icon="i-lucide-bed-single"/u)
})
