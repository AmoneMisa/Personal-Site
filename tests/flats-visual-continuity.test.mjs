import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const card = await readFile(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
const flatCss = await readFile(new URL('../app/assets/css/flat-placeholder.css', import.meta.url), 'utf8')

test('primary flat filters keep breathing room below the divider', () => {
  assert.match(flatCss, /\.filter-primary-grid\s*\{[\s\S]*?margin-top:\s*14px/u)
})

test('flat photos dissolve into the card with a contained dark fade on desktop and mobile', () => {
  assert.match(card, /\.flat-card__photo \{[^}]*aspect-ratio: 1\.5[^}]*overflow: hidden/u)
  assert.match(card, /bottom: 0; height: 40%/u)
  assert.doesNotMatch(card, /backdrop-filter/u)
  assert.match(card, /linear-gradient\(180deg, rgba\(11,16,42,0\) 0%, rgba\(11,16,42,\.14\) 34%, rgba\(11,16,42,\.55\) 74%, var\(--bg-panel\) 100%\)/u)
  assert.match(card, /@include bp-down\(md\)[\s\S]*?height: 148px/u)
  assert.match(card, /linear-gradient\(90deg, rgba\(11,16,42,0\) 0%, rgba\(11,16,42,\.16\) 34%, rgba\(11,16,42,\.58\) 72%, var\(--bg-panel\) 100%\)/u)
})
