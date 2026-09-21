import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { isOwnerKey, ownerLabel } from '../app/utils/flats/owners.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('owner keys are opaque 24-hex values; phone numbers are never keys', () => {
  assert.equal(isOwnerKey('a1b2c3d4e5f6a1b2c3d4e5f6'), true)
  for (const value of ['+998901234567', '@agent', 'A1B2C3D4E5F6A1B2C3D4E5F6', 'a1b2', '', null]) assert.equal(isOwnerKey(value), false, String(value))
})

test('owner contacts are shown readably', () => {
  assert.equal(ownerLabel('+998901234567'), '+998 90 123 45 67')
  assert.equal(ownerLabel('@agent_one'), '@agent_one')
  assert.equal(ownerLabel('+40721234567'), '+40 721 234 567')
  assert.equal(ownerLabel('+380671234567'), '+380 67 123 45 67')
  assert.equal(ownerLabel('+77012345678'), '+7 701 234 56 78')
  assert.equal(ownerLabel('+4915112345678'), '+4915112345678', 'unknown countries are not guessed at')
})

test('the owners tab lists collections and opening one filters the feed', async () => {
  const page = await read('app/pages/flat-finder/[[view]].vue')
  assert.match(page, /\{ value: "owners", label: t\("ownersTab"\) \}/u)
  assert.match(page, /<FlatOwnersGrid v-if="view === 'owners'" :country="ownersCountry" @select="openOwner" \/>/u)
  // Tabs are routes now, so switching goes through goToView (which navigates)
  // rather than assigning the ref directly.
  assert.match(page, /owner\.value = selected\.ownerKey;\s+goToView\("active"\);\s+scheduleLoad\(0\);/u)
  assert.match(page, /if \(view\.value === "owners"\) return \[\];/u, 'no listing cards under the owners tab')
})

test('an owner collection shows breadcrumbs back to all listings and to owners', async () => {
  const page = await read('app/pages/flat-finder/[[view]].vue')
  const crumbs = await read('app/components/flats/FlatOwnerBreadcrumbs.vue')
  assert.match(page, /<FlatOwnerBreadcrumbs v-if="owner && view === 'active'" :owner-key="owner" @all="leaveOwner\('active'\)" @owners="leaveOwner\('owners'\)" \/>/u)
  assert.match(crumbs, /aria-current="page"/u)
  assert.match(crumbs, /\$fetch<\{ owner: FlatOwner \| null \}>\("\/flats-owner"/u)
})

test('the owner filter is sent, kept in the URL, validated and reset', async () => {
  const filters = await read('app/composables/flats/useFlatFilters.ts')
  const route = await read('app/composables/flats/useFlatRouteState.ts')
  assert.match(filters, /if \(owner\.value\) params\.owner = owner\.value;/u)
  assert.match(filters, /owner\.value = "";/u)
  assert.match(route, /if \(owner\.value\) q\.owner = owner\.value;/u)
  assert.match(route, /filters\.owner\.value = isOwnerKey\(params\.owner\) \? params\.owner : "";/u)
})

test('owner routes validate input before calling the backend', async () => {
  const list = await read('server/routes/flats-owners.get.ts')
  const one = await read('server/routes/flats-owner.get.ts')
  assert.match(list, /\/\^\[A-Z\]\{2\}\$\/\.test\(country\)/u)
  assert.match(list, /\/\^\\d\{1,9\}:\[0-9a-f\]\{24\}\$\/\.test\(cursor\)/u)
  assert.match(one, /\/\^\[0-9a-f\]\{24\}\$\/\.test\(key\)/u)
})

test('owner components use the flats namespace and both languages have the labels', async () => {
  for (const file of ['app/components/flats/FlatOwnersGrid.vue', 'app/components/flats/FlatOwnerBreadcrumbs.vue']) {
    const source = await read(file)
    for (const [, key] of source.matchAll(/\bt\("([^"]+)"/gu)) assert.ok(key.startsWith('flats.'), `${file}: ${key}`)
    assert.doesNotMatch(source, /v-html/u)
  }
  for (const locale of ['ru', 'en']) {
    const messages = JSON.parse(await read(`i18n/locales/${locale}.json`))
    for (const key of ['ownersTab', 'ownersIntro', 'ownerListings', 'ownersEmpty', 'ownersFailed', 'ownersMore', 'ownerFallback', 'breadcrumbs']) {
      assert.ok(messages.flats[key], `${locale} ${key}`)
    }
  }
})
