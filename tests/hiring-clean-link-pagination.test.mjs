import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/hiring-feed.get.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
const routeState = await readFile(new URL('../app/composables/hiring/useHiringRouteState.ts', import.meta.url), 'utf8')
const preview = await readFile(new URL('../server/plugins/share-preview.ts', import.meta.url), 'utf8')

test('hiring-feed delegates publicId/profileId filtering to backend-platform', () => {
  assert.match(route, /requirePlatformGet\(event, 'cv', '\/hiring-feed'\)/)
  assert.doesNotMatch(route, /hiringSnapshot|matchesFilters|publicEntityId/)
})

test('opening or sharing a candidate prefers the bare publicId over the cv/cvSource/cvCountry triple', () => {
  assert.match(page, /async function openSharedCvByPublicId/)
  assert.match(page, /function activeCvQuery\(profile: CvProfile\): Record<string, string> \{\s*\n\s*return \{ adv: String\(candidatePublicId\(profile\)\) \};/)
  assert.match(page, /function makeCvShareLink\(profile: CvProfile\): string \{\s*\n\s*const resolved = router\.resolve\(\{ path: route\.path, query: activeCvQuery\(profile\) \}\);/)
  assert.match(page, /watch\(\(\) => queryString\(route\.query\.adv\)/)
  assert.match(page, /void openSharedCvByPublicId\(publicId\)/)
  assert.match(page, /watch\(\(\) => queryString\(route\.query\.cv\)/)
  assert.match(page, /async function openSharedCv\(id: string, sourceName = "", countryCode = "", attempt = 0\)/)
})

test('SSR preview understands the clean ?adv= candidate link', () => {
  assert.match(preview, /const publicId = queryValue\(query\.adv\)\.trim\(\)/)
  assert.match(preview, /findPlatformSharedCandidate\(id, Boolean\(publicId\), source, country\)/)
  assert.match(preview, /meta\.url = cleanEntityUrl\(pathname, publicId\)/)
})

test('closing a profile preserves the ?page= scroll bookmark instead of wiping it', () => {
  assert.match(page, /const pageParam = queryString\(route\.query\.page\)/)
  assert.match(page, /\.\.\.\(pageParam \? \{ page: pageParam \} : \{\}\)/)
})

test('the hiring route state preserves adv/page across debounced filter syncs', () => {
  assert.match(routeState, /for \(const key of \["adv", "cv", "cvSource", "cvCountry", "page"\] as const\)/)
})

test('a deep-linked ?page=n restores loaded results before the URL is resynced to page 1', () => {
  assert.match(page, /const pageRestoring = ref\(true\)/)
  assert.match(page, /function currentPageNumber\(\): number/)
  assert.match(page, /async function syncPageInUrl\(pageNumber: number\)/)
  assert.match(page, /async function restoreToPage\(targetPage: number\)/)
  assert.match(page, /if \(!background && !pageRestoring\.value\) await syncPageInUrl\(currentPageNumber\(\)\)/)
  assert.match(page, /await syncPageInUrl\(currentPageNumber\(\)\);\s*\n[\s\S]*?if \(!append && !background\) await syncQueryParams\(\);/)

  const mountedStart = page.indexOf('onMounted(async () => {')
  const mountedEnd = page.indexOf('\nwatch(modalOpen', mountedStart)
  const mounted = page.slice(mountedStart, mountedEnd)
  assert.match(mounted, /await load\(false\);\s*\n\s*if \(requestedPage > 1\) await restoreToPage\(requestedPage\);\s*\n\s*pageRestoring\.value = false;/)
})
