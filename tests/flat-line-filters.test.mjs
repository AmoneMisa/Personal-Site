import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('trusted and hide-danger toggles are real filters, sent and restored from the URL', async () => {
  const filters = await read('app/composables/flats/useFlatFilters.ts')
  const route = await read('app/composables/flats/useFlatRouteState.ts')
  const blocks = await read('app/composables/flats/useFlatFilterBlocks.ts')
  assert.match(filters, /if \(trustedOnly\.value\) params\.trustedOnly = "1";/u)
  assert.match(filters, /if \(hideDanger\.value\) params\.hideDanger = "1";/u)
  assert.match(filters, /trustedOnly\.value = false;\r?\n\s+hideDanger\.value = false;/u, 'reset clears both')
  assert.match(route, /q\.trustedOnly = "1"/u)
  assert.match(route, /filters\.hideDanger\.value = queryBoolean\(params\.hideDanger\)/u)
  assert.match(blocks, /id: "trusted-only", control: "checkbox"/u)
  assert.match(blocks, /id: "hide-danger", control: "checkbox"/u)
  assert.doesNotMatch(blocks, /yellow|check-line|worth-checking/iu, 'no yellow toggle')
})

test('both languages label the toggles and the popup tab', async () => {
  for (const locale of ['ru', 'en']) {
    const messages = await read(`i18n/locales/${locale}.json`)
    for (const key of ['trustedOnly', 'hideDanger', 'contactListingsTab', 'listingDetailsTab', 'contactListingsEmpty', 'contactListingsFailed']) {
      assert.match(messages, new RegExp(`"${key}":`, 'u'), `${locale} ${key}`)
    }
  }
})

test('popup components use the flats message namespace', async () => {
  // Regression: the page prefixes keys with "flats." itself; components using
  // useI18n directly rendered raw keys like "listingDetailsTab".
  for (const file of ['app/components/flats/FlatModalTabs.vue', 'app/components/flats/FlatContactListings.vue']) {
    const source = await read(file)
    for (const [, key] of source.matchAll(/\bt\("([^"]+)"/gu)) assert.ok(key.startsWith('flats.'), `${file}: ${key}`)
  }
})

test('the popup shows a contact tab only when the contact has other listings', async () => {
  const page = await read('app/pages/flat-finder/[...slug].vue')
  assert.match(page, /<FlatModalTabs v-if="activeContactListingCount > 0" v-model="modalTab"/u)
  assert.match(page, /<FlatContactListings v-if="modalTab === 'contact' && activeContactListingCount > 0" :public-id="active\.publicId" @open="openListing" \/>/u)
  assert.match(page, /modalTab\.value = "details";/u, 'every newly opened listing starts on its own details')
})

test('contact listings load lazily, ignore stale responses and reopen in the popup', async () => {
  const component = await read('app/components/flats/FlatContactListings.vue')
  assert.match(component, /\$fetch<\{ listings: FlatListing\[\] \}>\("\/flats-contact-listings"/u)
  assert.match(component, /if \(props\.publicId === publicId\) listings\.value/u)
  assert.match(component, /@click="emit\('open', listing\)"/u)
  assert.doesNotMatch(component, /v-html/u)
})

test('the contact listings route validates the id and shapes listings like the feed', async () => {
  const route = await read('server/routes/flats-contact-listings.get.ts')
  assert.match(route, /!Number\.isSafeInteger\(publicId\) \|\| publicId <= 0/u)
  assert.match(route, /\/api\/listing\/by-public-id\/\$\{publicId\}\/contact-listings/u)
  assert.match(route, /data\.listings\.map\(shapeListing\)/u)
})
