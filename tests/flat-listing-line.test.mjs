import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { LISTING_LINES, listingLineOf, listingLineLegend, listingLineTitle } from '../app/utils/flats/listingLine.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('only the three backend lines are accepted, with no yellow', () => {
  assert.deepEqual([...LISTING_LINES], ['steady', 'phantom_risk', 'multi_listing'])
  assert.equal(listingLineOf('check'), null)
  for (const line of LISTING_LINES) assert.equal(listingLineOf(line), line)
  for (const value of [null, undefined, '', 'fraud', 'red', '<script>', 42]) assert.equal(listingLineOf(value), null)
})

test('the legend has four entries in design order, in both languages', () => {
  for (const locale of ['ru', 'en']) {
    assert.deepEqual(listingLineLegend(locale).map((item) => item.line), ['steady', 'phantom_risk', 'multi_listing', 'none'])
  }
})

test('line wording describes listings, never accuses people', () => {
  const text = ['ru', 'en'].flatMap((locale) => listingLineLegend(locale).flatMap((item) => [item.title, item.hint])).join('\n')
  assert.doesNotMatch(text, /мошенник|не связываться|fraud|scam|проверен|verified|надёжный риелтор/iu)
})

test('a card line gets a tooltip, no line gets none', () => {
  assert.equal(listingLineTitle('phantom_risk', 'ru'), 'Похоже на фантом — Будьте осторожны')
  assert.equal(listingLineTitle('multi_listing', 'ru'), 'У контакта есть ещё объявления')
  assert.equal(listingLineTitle(null, 'en'), undefined)
})

test('the line is the card outline only, not a divider under the photo', async () => {
  const card = await read('app/components/flats/FlatCard.vue')
  assert.match(card, /\[`flat-card_line_\$\{line\}`\]: Boolean\(line\)/u)
  assert.match(card, /\.flat-card\[class\*="flat-card_line_"\], \.flat-card\[class\*="flat-card_line_"\]:hover \{ border:/u)
  assert.doesNotMatch(card, /flat-card__photo[^{]*\{[^}]*border-bottom/u)
})

test('the legend is shown with the results and colours come from shared tokens', async () => {
  const page = await read('app/pages/flat-finder/index.vue')
  const css = await read('app/assets/css/main.css')
  assert.match(page, /<FlatLineLegend v-if="displayedListings\.length" \/>/u)
  for (const token of ['--flat-line-steady', '--flat-line-phantom', '--flat-line-multi', '--flat-line-none']) assert.match(css, new RegExp(token, 'u'))
})
