import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const PAGE = 'app/pages/flat-finder/[...slug].vue'

test('personal tabs are routes, so they are linkable and survive a refresh', async () => {
  const page = await read(PAGE)
  assert.match(page, /const view = ref<FlatView>\(viewFromRoute\(routeSlug\(\)\)\)/u)
  assert.match(page, /function goToView\(next: FlatView\)/u)
  // Back/forward and pasted links move the tab and the open collection.
  assert.match(page, /watch\(\(\) => route\.params\.slug/u)
})

test('an unknown segment is a 404, not the default view at a made-up URL', async () => {
  const page = await read(PAGE)
  assert.match(page, /definePageMeta\(\{\s*validate:/u)
  for (const segment of ['owners', 'favorites', 'recent', 'hidden']) {
    assert.match(page, new RegExp(`"${segment}"`, 'u'), segment)
  }
})

test('only the search itself is indexable; personal tabs are not', async () => {
  const page = await read(PAGE)
  assert.match(page, /const raw = route\.params\.slug;[\s\S]*?depth \? "noindex, follow" : "index, follow"/u)
})

test('entering and leaving a collection only navigates, never both', async () => {
  const page = await read(PAGE)
  // Setting the filter here as well raced with the filter sync's own
  // router.replace, which captures the path as it runs and put the URL back.
  assert.match(page, /function leaveOwner\(next: FlatView\) \{\s+goToView\(next\);\s+\}/u)
  assert.doesNotMatch(page, /owner\.value = selected\.ownerKey/u)
})
