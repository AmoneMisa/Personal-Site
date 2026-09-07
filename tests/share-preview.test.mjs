import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { buildFlatShareMeta, findSharedFlat, wrapShareText } from '../server/utils/sharePreview.ts'
import { withPageShareImage } from '../server/utils/shareHead.ts'
import { renderShareOgPng } from '../server/utils/shareOgImage.ts'

test('flat title uses canonical city, price and localized deal rather than source headline', () => {
  const flat = { title: 'Unrelated provider headline', city: 'Tashkent', price: 650, currency: 'USD', dealType: 'longRent' }
  assert.equal(buildFlatShareMeta(flat, '1', '', '', '/en/flat-finder').title, 'Tashkent · 650 USD · Long rent')
  assert.equal(buildFlatShareMeta(flat, '1').title, 'Tashkent · 650 USD · Долгосрочная аренда')
  assert.doesNotMatch(buildFlatShareMeta({city: 'Tashkent'}, '2').title, /undefined|null|NaN/)
})

test('flat public IDs use the existing upstream detail adapter with social timeout', async () => {
  const previous = globalThis.$fetch
  globalThis.$fetch = async (url, options) => {
    assert.match(url, /\/api\/listing\/by-public-id\/6965161$/)
    assert.equal(options.timeout, 2500)
    return { listing: { id: 'source-id', publicId: 6965161, city: 'Tashkent' } }
  }
  try {
    assert.equal((await findSharedFlat('6965161', '', '', true)).id, 'source-id')
  } finally {
    globalThis.$fetch = previous
  }
})

test('page and quiz images use SSR titles and preserve unrelated head tags', () => {
  const head = ['<title>Fallback</title><link rel="stylesheet" href="/app.css"><meta property="og:title" content="Career &amp; life"><meta property="og:locale" content="en_US"><meta property="og:image" content="old"><meta name="twitter:image" content="old">']
  const result = withPageShareImage(head, '/en/quizzes/career-fit', 'https://whiteslove.me').join('')
  assert.match(result, /app.css/)
  assert.match(result, /og:locale/)
  assert.doesNotMatch(result, /content="old"/)
  const url = result.match(/property="og:image" content="([^"]*)"/)[1].replaceAll('&amp;', '&')
  assert.equal(new URL(url).searchParams.get('title'), 'Career & life')
  assert.equal(new URL(url).searchParams.get('kind'), 'quiz')
  assert.equal((result.match(/property="og:image"/g) || []).length, 1)
})

test('share text bounds long unbroken titles', () => {
  const lines = wrapShareText('W'.repeat(100), 22, 3)
  assert.equal(lines.length, 3)
  assert.ok(lines.every(line => line.length <= 22))
})

test('all card types render real 1200x630 PNGs with the bundled artwork', async () => {
  const artwork = await readFile(new URL('../server/assets/og/ocean.jpg', import.meta.url))
  for (const kind of ['site', 'flat', 'job', 'candidate', 'quiz']) {
    const png = await renderShareOgPng({ kind, title: 'Ташкент · 650 USD · Аренда', description: 'Vue & TypeScript <safe>' }, artwork)
    const metadata = await sharp(png).metadata()
    assert.equal(metadata.format, 'png')
    assert.equal(metadata.width, 1200)
    assert.equal(metadata.height, 630)
  }
})

test('SSR recognizes adv flat links and emits the matching public-ID image URL', async () => {
  const previous = { defineNitroPlugin: globalThis.defineNitroPlugin, getRequestURL: globalThis.getRequestURL, getQuery: globalThis.getQuery }
  globalThis.defineNitroPlugin = callback => callback
  globalThis.getRequestURL = () => new URL('https://whiteslove.me/flat-finder?adv=6965161')
  globalThis.getQuery = () => ({ adv: '6965161' })
  try {
    const { default: plugin } = await import('../server/plugins/share-preview.ts')
    let render
    plugin({ hooks: { hook: (name, callback) => { assert.equal(name, 'render:html'); render = callback } } })
    const html = { head: ['<title>Flat Finder</title><meta property="og:image" content="old">'] }
    await render(html, { event: {} })
    const head = html.head.join('')
    assert.match(head, /og:title" content="Tashkent"/)
    assert.match(head, /publicId=1/)
    assert.match(head, /og:url" content="https:\/\/whiteslove.me\/flat-finder\?adv=6965161"/)
    assert.equal((head.match(/property="og:image"/g) || []).length, 1)
  } finally {
    Object.assign(globalThis, previous)
  }
})

test('jobs and CV titles include identity, location and compensation', async () => {
  const { buildJobShareMeta, buildCandidateShareMeta } = await import('../server/utils/sharePreview.ts')
  assert.equal(buildJobShareMeta({ title: 'Developer', company: 'Acme', location: 'Tashkent', salaryMin: 2000, salaryCurrency: 'USD' }, 'job-1').title, 'Developer · Acme · Tashkent · from 2,000 USD')
  assert.equal(buildCandidateShareMeta({ name: 'Alex', role: 'Designer', city: 'Tashkent', salaryMin: 1500, currency: 'USD' }, 'cv-1').title, 'Alex · Designer · Tashkent · from 1,500 USD')
})

test('Nitro production byte-array artwork renders identically to a development buffer', async () => {
  const artwork = await readFile(new URL('../server/assets/og/ocean.jpg', import.meta.url))
  const card = { kind: 'site', title: 'WhitesLove' }
  const expected = await renderShareOgPng(card, artwork)
  const production = await renderShareOgPng(card, new Uint8Array(artwork))
  assert.deepEqual(production, expected)
  assert.ok(production.length > 100000, 'illustrated PNG should include the ocean artwork')
})
