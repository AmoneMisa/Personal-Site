import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const card = await readFile(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
const flatCss = await readFile(new URL('../app/assets/css/flat-placeholder.css', import.meta.url), 'utf8')

test('primary flat filters keep breathing room below the divider', () => {
  assert.match(flatCss, /\.filter-primary-grid\s*\{[\s\S]*?margin-top:\s*14px/u)
})

test('flat photos blend into the card instead of ending on a hard edge', () => {
  assert.match(card, /\.flat-card__photo \{[^}]*overflow: visible/u)
  assert.match(card, /bottom: -30px; height: 58%/u)
  assert.match(card, /backdrop-filter: blur\(6px\)/u)
  assert.match(card, /rgba\(11,16,42,\.68\)[\s\S]*?var\(--bg-panel\) 100%/u)
  assert.match(card, /@media \(max-width: 760px\)[\s\S]*?overflow: visible/u)
  assert.match(card, /linear-gradient\(90deg, transparent 0%, rgba\(11,16,42,\.30\)/u)
})
