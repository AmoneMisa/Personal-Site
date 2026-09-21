import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const PAGE = 'app/pages/flat-finder/[[view]].vue'
const COLLECTION_PAGE = 'app/pages/flat-finder/collections/[id].vue'
const COMPOSABLE = 'app/composables/flats/useFlatCollections.ts'

test('personal tabs are routes, so they are linkable and survive a refresh', async () => {
  const page = await read(PAGE)
  // The view comes from the URL segment, not a bare ref.
  assert.match(page, /const view = ref<FlatView>\(viewFromRoute\(route\.params\.view\)\)/u)
  assert.match(page, /function goToView\(next: FlatView\)/u)
  // Back/forward moves the tab.
  assert.match(page, /watch\(\(\) => route\.params\.view/u)
  // Every tab switch navigates rather than assigning the ref.
  assert.doesNotMatch(page, /view\.value = "(active|owners|collections|favorites|recent|hidden)"/u)
})

test('an unknown tab segment is a 404, not the default view at a made-up URL', async () => {
  const page = await read(PAGE)
  assert.match(page, /definePageMeta\(\{\s*validate:/u)
  for (const segment of ['owners', 'collections', 'favorites', 'recent', 'hidden']) {
    assert.match(page, new RegExp(`"${segment}"`, 'u'), segment)
  }
})

test('only the search itself is indexable; personal tabs are not', async () => {
  const page = await read(PAGE)
  assert.match(page, /robots: \(\) => \(route\.params\.view \? "noindex, follow" : "index, follow"\)/u)
  const collection = await read(COLLECTION_PAGE)
  assert.match(collection, /robots: \(\) => "noindex, nofollow"/u)
})

test('collections keep the shape the app and backend already use', async () => {
  const composable = await read(COMPOSABLE)
  // Same fields as Flutter's SortedCollection / user_data.saved_collections,
  // so these can sync later without a migration.
  for (const field of ['id', 'title', 'isPreset', 'presetName', 'items']) {
    assert.match(composable, new RegExp(`${field}[?]?:`, 'u'), field)
  }
  // Backend caps (MAX_SORTED_COLLECTIONS) must not be exceeded locally.
  assert.match(composable, /MAX_COLLECTIONS = 100/u)
})

test('a collection lives on its own page, reachable from the tab', async () => {
  const page = await read(PAGE)
  assert.match(page, /function collectionPath\(id: string\)/u)
  assert.match(page, /\/flat-finder\/collections\/\$\{encodeURIComponent\(id\)\}/u)
  const collection = await read(COLLECTION_PAGE)
  // Rendered straight from storage: saved listings carry their full payload.
  assert.match(collection, /collections\.value\.find\(\(item\) => item\.id === collectionId\.value\)/u)
  // `loaded` avoids flashing "not found" before localStorage is read.
  assert.match(collection, /v-if="loaded && !collection"/u)
})
