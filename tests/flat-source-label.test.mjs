import assert from 'node:assert/strict'
import test from 'node:test'

import { customSiteDomain, flatSourceLabel } from '../app/utils/flats/sourceLabel.ts'

test('customSiteDomain strips www and extracts the bare hostname', () => {
  assert.equal(customSiteDomain('https://www.lun.ua/rent/kyiv/flats'), 'lun.ua')
  assert.equal(customSiteDomain('https://dom.ria.com/uk/arenda-kvartir/'), 'dom.ria.com')
  assert.equal(customSiteDomain(null), null)
  assert.equal(customSiteDomain(undefined), null)
  assert.equal(customSiteDomain('not-a-url'), null)
})

test('flatSourceLabel shows the real site for custom listings instead of the generic bucket name', () => {
  assert.equal(flatSourceLabel('olx', null, 'Sites'), 'OLX')
  assert.equal(flatSourceLabel('telegram', null, 'Sites'), 'Telegram')
  assert.equal(flatSourceLabel('custom', 'https://www.lun.ua/rent/kyiv/flats', 'Sites'), 'lun.ua')
  assert.equal(flatSourceLabel('custom', null, 'Sites'), 'Sites')
})
