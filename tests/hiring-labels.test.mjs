import test from 'node:test'
import assert from 'node:assert/strict'

import { decorateHiringFeed, decorateHiringMeta, hiringUiLocale } from '../server/utils/hiringLabels.ts'

test('hiring labels are resolved on the server per UI locale', () => {
  const feed = () => ({
    profiles: [{ id: '1', city: 'Kyiv', country: 'UA' }, { id: '2', city: '', country: 'UZ' }],
    statistics: { locations: [{ label: 'Kyiv', value: 3 }, { label: '__unknown__', value: 1 }] },
  })

  const ru = decorateHiringFeed(feed(), 'ru')
  const en = decorateHiringFeed(feed(), 'en')

  assert.equal(typeof ru.profiles[0].cityLabel, 'string')
  assert.ok(ru.profiles[0].cityLabel.length > 0)
  assert.notEqual(ru.profiles[0].cityLabel, en.profiles[0].cityLabel)
  assert.equal(ru.profiles[0].countryLabel.length > 0, true)
  assert.equal('cityLabel' in ru.profiles[1], false)
  assert.equal(typeof ru.statistics.locations[0].display, 'string')
  assert.equal('display' in ru.statistics.locations[1], false)
})

test('hiring meta gets a city label map and non-array payloads pass through', () => {
  const meta = decorateHiringMeta([{ code: 'UA', cities: ['Kyiv', 'Lviv'] }, { code: 'XX' }], 'en')
  assert.deepEqual(Object.keys(meta[0].cityLabels), ['Kyiv', 'Lviv'])
  assert.equal('cityLabels' in meta[1], false)
  assert.deepEqual(decorateHiringMeta({ error: 'x' }, 'en'), { error: 'x' })
  assert.equal(decorateHiringFeed(null, 'ru'), null)
})

test('only English locales switch the label language', () => {
  assert.equal(hiringUiLocale('en'), 'en')
  assert.equal(hiringUiLocale(['en-US']), 'en')
  assert.equal(hiringUiLocale('ru'), 'ru')
  assert.equal(hiringUiLocale(undefined), 'ru')
})
