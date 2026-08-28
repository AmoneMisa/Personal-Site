import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyWebCursor } from '../shared/hiring/hiringCursors.ts'
import { crawlIshBorPages } from '../shared/hiring/sources/ishBorCrawler.ts'
import { listHiringLinkedInSourceKeys } from '../shared/hiring/sources/linkedInSources.ts'
import { listHiringSocialSourceKeys } from '../shared/hiring/sources/socialSources.ts'
import { HIRING_TELEGRAM_CHANNELS } from '../shared/hiring/sources/telegramChannels.ts'
import { hiringLinkedInSourceHandles, listHiringLinkedInSources } from '../server/hiring/sources/linkedInRefresh.ts'
import { hiringSocialSourceHandles, listSocialSources } from '../server/hiring/sources/socialRefresh.ts'

test('Tashkent hiring discovery uses broad RU, UZ and EN social search coverage', () => {
  const social = listHiringSocialSourceKeys().filter((key) => key.startsWith('threads-uz-'))
  const linkedin = listHiringLinkedInSourceKeys().filter((key) => key.startsWith('linkedin-uz-'))

  assert.ok(social.length >= 9)
  assert.ok(linkedin.length >= 8)
  assert.ok(social.includes('threads-uz-ru-parttime'))
  assert.ok(social.includes('threads-uz-uz-izlayapman'))
  assert.ok(social.includes('threads-uz-en-looking'))
  assert.ok(linkedin.includes('linkedin-uz-tashkent-open-to-work'))
  assert.ok(linkedin.includes('linkedin-uz-tashkent-ish-qidiryapman'))
})

test('shared social/LinkedIn discovery catalogs stay aligned with executable targets', () => {
  const socialRuntime = new Set(hiringSocialSourceHandles().map((value) => value.replace(/^social:/, '')))
  const linkedInRuntime = new Set(hiringLinkedInSourceHandles().map((value) => value.replace(/^linkedin:/, '')))

  assert.deepEqual(new Set(listHiringSocialSourceKeys()), socialRuntime)
  assert.deepEqual(new Set(listSocialSources().map((source) => source.key)), socialRuntime)
  assert.deepEqual(new Set(listHiringLinkedInSourceKeys()), linkedInRuntime)
  assert.deepEqual(new Set(listHiringLinkedInSources().map((source) => source.key)), linkedInRuntime)
})

test('Tashkent-heavy public resume Telegram feeds are part of the canonical hiring catalog', () => {
  const byHandle = new Map(HIRING_TELEGRAM_CHANNELS.map((channel) => [channel.handle.toLowerCase(), channel]))

  for (const handle of ['freelancer_uzbek', 'jobs_uz_vacancy']) {
    const source = byHandle.get(handle)
    assert.ok(source, handle)
    assert.equal(source.country, 'UZ')
    assert.equal(source.requireCandidateMarker, true)
    assert.equal(source.priority, 'high')
  }
})

test('IshBor historical crawl continues past an old sparse page', async () => {
  const originalFetch = globalThis.fetch
  const originalBackfill = process.env.HIRING_ISHBOR_BACKFILL_PAGES
  process.env.HIRING_ISHBOR_BACKFILL_PAGES = '2'

  const listing = (id) => `<article><a href="/ru/ishchilar/id/${id}">Candidate ${id}</a></article>`
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url === 'https://ish-bor.uz/ru/ishchilar') return new Response(listing(101))
    if (url === 'https://ish-bor.uz/ru/ishchilar?page=2') return new Response(listing(201))
    if (url === 'https://ish-bor.uz/ru/ishchilar?page=3') return new Response(listing(301))
    if (url.endsWith('/id/201')) return new Response('old profile')
    if (url.endsWith('/id/101') || url.endsWith('/id/301')) return new Response('recent profile')
    throw new Error(`unexpected fetch ${url}`)
  }

  try {
    const run = await crawlIshBorPages(
      emptyWebCursor('ishbor-uz'),
      (summary, detailHtml) => detailHtml.includes('recent') ? { id: summary.url } : null,
    )

    assert.equal(run.profiles.length, 2)
    assert.equal(run.cursor.bootstrapComplete, false)
    assert.equal(run.cursor.backfillPage, 4)
  } finally {
    globalThis.fetch = originalFetch
    if (originalBackfill === undefined) delete process.env.HIRING_ISHBOR_BACKFILL_PAGES
    else process.env.HIRING_ISHBOR_BACKFILL_PAGES = originalBackfill
  }
})

test('IshBor retries a historical page when one of its detail requests fails', async () => {
  const originalFetch = globalThis.fetch
  const originalBackfill = process.env.HIRING_ISHBOR_BACKFILL_PAGES
  process.env.HIRING_ISHBOR_BACKFILL_PAGES = '1'

  const listing = (id) => `<article><a href="/ru/ishchilar/id/${id}">Candidate ${id}</a></article>`
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url === 'https://ish-bor.uz/ru/ishchilar') return new Response(listing(101))
    if (url === 'https://ish-bor.uz/ru/ishchilar?page=2') return new Response(listing(201))
    if (url.endsWith('/id/101')) return new Response('recent profile')
    if (url.endsWith('/id/201')) throw new Error('temporary detail failure')
    throw new Error(`unexpected fetch ${url}`)
  }

  try {
    const run = await crawlIshBorPages(
      emptyWebCursor('ishbor-uz'),
      (summary, detailHtml) => detailHtml.includes('recent') ? { id: summary.url } : null,
    )

    assert.equal(run.cursor.bootstrapComplete, false)
    assert.equal(run.cursor.backfillPage, 2)
  } finally {
    globalThis.fetch = originalFetch
    if (originalBackfill === undefined) delete process.env.HIRING_ISHBOR_BACKFILL_PAGES
    else process.env.HIRING_ISHBOR_BACKFILL_PAGES = originalBackfill
  }
})
