import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/jobs-vacancy.get.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/jobs/index.vue', import.meta.url), 'utf8')
const routeState = await readFile(new URL('../app/composables/jobs/useJobRouteState.ts', import.meta.url), 'utf8')
const preview = await readFile(new URL('../server/plugins/share-preview.ts', import.meta.url), 'utf8')

test('jobs-vacancy delegates id and publicId lookups to backend-platform', () => {
  assert.match(route, /requirePlatformGet\(event, 'vacancies', '\/jobs-vacancy'\)/)
  assert.doesNotMatch(route, /jobsSnapshot|getJobByPublicIdDb|publicEntityId/)
})

test('jobs page now shares vue-router state with flats/hiring instead of raw window.history', () => {
  assert.match(page, /const route = useRoute\(\);/)
  assert.match(page, /const router = useRouter\(\);/)
  assert.match(page, /useJobRouteState\(\{\s*\n\s*router,\s*\n\s*route,/)
  assert.doesNotMatch(page, /window\.location\.search/)
  assert.doesNotMatch(page, /window\.history\.replaceState/)
})

test('opening or sharing a job prefers the bare publicId over the legacy ?job=<id> link', () => {
  assert.match(page, /async function openSharedJobByPublicId/)
  assert.match(page, /function syncJobInUrl\(job: Job \| null\)/)
  assert.match(page, /query\.adv = String\(jobPublicId\(job\)\)/)
  assert.match(page, /const query = \{ adv: String\(publicEntityId\("job", job\.source, job\.id\)\) \};/)
  assert.match(page, /watch\(\(\) => queryString\(route\.query\.adv\)/)
  assert.match(page, /void openSharedJobByPublicId\(publicId\)/)
  assert.match(page, /watch\(\(\) => queryString\(route\.query\.job\)/)
})

test('SSR preview understands the clean ?adv= vacancy link', () => {
  assert.match(preview, /const publicId = queryValue\(query\.adv\)\.trim\(\)/)
  assert.match(preview, /findPlatformSharedJob\(id, Boolean\(publicId\)\)/)
  assert.match(preview, /meta\.url = cleanEntityUrl\(pathname, publicId\)/)
})

test('the job route state preserves adv/job/page across debounced filter syncs', () => {
  assert.match(routeState, /const NON_FILTER_KEYS = new Set\(\["adv", "job", "page"\]\);/)
  assert.match(routeState, /for \(const key of NON_FILTER_KEYS\)/)
})

test('a deep-linked ?page=n restores loaded pages before the URL is resynced', () => {
  assert.match(page, /const pageRestoring = ref\(true\)/)
  assert.match(page, /async function syncPageInUrl\(pageNumber: number\)/)
  assert.match(page, /async function restoreToPage\(targetPage: number\)/)
  assert.match(page, /if \(!options\.background && !pageRestoring\.value\) await syncPageInUrl\(page\.value\)/)
  assert.match(page, /await syncPageInUrl\(page\.value\);\s*\n[\s\S]*?if \(!options\.append && !options\.background\) await persistState\(\);/)

  const mountedStart = page.indexOf('onMounted(async () => {')
  const mountedEnd = page.indexOf('\nwatch(jobModalOpen', mountedStart)
  const mounted = page.slice(mountedStart, mountedEnd)
  assert.match(mounted, /await load\(1\);\s*\n\s*if \(requestedPage > 1\) await restoreToPage\(requestedPage\);\s*\n\s*pageRestoring\.value = false;/)
})
