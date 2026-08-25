import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const card = await readFile(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
const flatCss = await readFile(new URL('../app/assets/css/flat-placeholder.css', import.meta.url), 'utf8')

test('primary flat filters keep breathing room below the divider', () => {
  assert.match(flatCss, /\.filter-primary-grid\s*\{[\s\S]*?margin-top:\s*14px/u)
})

test('flat photos keep the subtle clipped fade without backdrop blur', () => {
  assert.match(card, /\.flat-card__photo \{[^}]*overflow: hidden/u)
  assert.match(card, /bottom: -28px; height: 48%/u)
  assert.doesNotMatch(card, /backdrop-filter/u)
  assert.match(card, /linear-gradient\(180deg, transparent 0%, rgba\(11,16,42,\.34\) 52%, var\(--bg-panel\) 100%\)/u)
  assert.match(card, /@media \(max-width: 760px\)[\s\S]*?overflow: hidden/u)
  assert.match(card, /linear-gradient\(90deg, transparent 0%, rgba\(11,16,42,\.36\) 48%, var\(--bg-panel\) 96%\)/u)
})
