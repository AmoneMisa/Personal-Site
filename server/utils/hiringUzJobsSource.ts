// Public, anonymous rows from the UzJobs closed-resume index.
//
// The board intentionally hides names and direct contacts from logged-out
// visitors. We preserve that boundary: only the public id, desired categories,
// region and last-visit date are stored, and contact remains "via platform".

import { emptyWebCursor, loadWebCursors, saveWebCursor, type WebCursor } from './hiringCursors'
import { hiringDbEnabled, saveDbCandidates } from './hiringDb'
import { recordWebDiagnostic, type SourceRun, type WebSourceDiagnostic } from './hiringDiagnostics'
import { normalizeCandidate } from './hiringNormalize'
import type { CvProfile } from './hiringTypes'
import { cityFrom, cutoffDate } from './hiringWebFields'
import { persistWebProfiles } from './hiringWebSources'
import { parseUzJobsRows } from './hiringUzJobsFields'

const SOURCE_KEY = 'uzjobs-uz'
const SOURCE_LABEL = 'UzJobs'
const REQUEST_TIMEOUT_MS = 25_000
// The public directory currently contains several thousand rows. Its pages are
// NOT sorted monotonically by last visit: an old profile can be active today,
// while the next page can temporarily contain no recently active rows. A one-
// page "no recent candidates" cutoff therefore loses most of the directory.
const MAX_BACKFILL_PAGES = 60
const DEFAULT_BACKFILL_PAGES = 40
const MAX_INDEX_PAGE = 260
const FETCH_CONCURRENCY = 4
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function pageUrl(page: number): string {
  // The first full page of closed profiles is numbered 2 by the source.
  return `https://uzjobs.uz/r/resume-2-${Math.max(2, page + 1)}.html`
}

function profileUrl(id: string): string {
  // Stable across pagination shifts. The source's public search form accepts
  // this id; whether details are shown still remains the source's decision.
  return `https://uzjobs.uz/resume.cgi?srid=${id}`
}

/** Parse one public listing page without network or storage side effects. */
export function parseUzJobsPage(html: string): CvProfile[] {
  return parseUzJobsRows(html).map(({ id, roles, region, activityAt, activityText }) => {
    const originalText = [...roles, region, activityText].join('\n')
    return normalizeCandidate({
      id: `web-${SOURCE_KEY}-${id}`,
      source: 'telegram',
      origin: 'web',
      sourceKey: SOURCE_KEY,
      sourceLabel: SOURCE_LABEL,
      sourceCountry: 'UZ',
      country: 'UZ',
      name: '',
      role: roles[0]!,
      professions: roles,
      city: cityFrom(region, 'UZ') || region,
      url: profileUrl(id),
      publishedAt: null,
      updatedAt: activityAt,
      activityAt,
      createdAt: activityAt,
      originalText,
      description: originalText,
      tags: [SOURCE_LABEL, 'Web CV', 'Uzbekistan', 'Anonymous profile'],
      contact: profileUrl(id),
      contactType: 'platform',
    })
  })
}

async function fetchPage(page: number): Promise<string> {
  const url = pageUrl(page)
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru,en;q=0.8',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  // The source declares Windows-1251. Response.text() would decode it as UTF-8
  // and silently corrupt every Cyrillic profession and region.
  return new TextDecoder('windows-1251').decode(await response.arrayBuffer())
}

async function fetchProfiles(cursor: WebCursor): Promise<{
  profiles: CvProfile[]
  fetched: number
  pages: number
  cursor: WebCursor
}> {
  const backfillPages = Math.max(1, Math.min(
    MAX_BACKFILL_PAGES,
    Number(process.env.HIRING_UZJOBS_BACKFILL_PAGES) || DEFAULT_BACKFILL_PAGES,
  ))
  const savedBackfillPage = Math.max(2, cursor.backfillPage || 2)
  // The first implementation marked bootstrapComplete as soon as one page had
  // zero recent visits. Existing production cursors can therefore say "done"
  // after only a few hundred rows. Only the new sentinel (> MAX_INDEX_PAGE)
  // proves this implementation actually reached the directory end/hard cap.
  const legacyPrematureComplete = cursor.bootstrapComplete && savedBackfillPage <= MAX_INDEX_PAGE
  const backfillStart = savedBackfillPage
  let bootstrapComplete = cursor.bootstrapComplete && !legacyPrematureComplete
  if (backfillStart > MAX_INDEX_PAGE) bootstrapComplete = true

  const historicalPages = bootstrapComplete
    ? []
    : Array.from(
      { length: Math.min(backfillPages, MAX_INDEX_PAGE - backfillStart + 1) },
      (_, index) => backfillStart + index,
    )
  const pages = bootstrapComplete ? [1] : [1, ...historicalPages]
  const byId = new Map<string, CvProfile>()
  let fetched = 0
  let pagesRead = 0
  let lastHistoricalPage = backfillStart - 1
  let reachedDirectoryEnd = false

  // Four parallel page reads keep a 40-page backfill round comfortably inside
  // the queue request timeout without hammering the public board. Results are
  // still processed in page order so the cursor remains deterministic.
  for (let offset = 0; offset < pages.length; offset += FETCH_CONCURRENCY) {
    const batch = pages.slice(offset, offset + FETCH_CONCURRENCY)
    const results = await Promise.all(batch.map(async (page) => ({
      page,
      parsed: parseUzJobsPage(await fetchPage(page)),
    })))

    for (const { page, parsed } of results) {
      pagesRead += 1
      fetched += parsed.length
      if (page > 1) lastHistoricalPage = page

      // Empty pagination is the only reliable end-of-directory signal. Do not
      // stop on zero recent rows: last-visit freshness is interleaved across
      // pages and later pages can contain candidates active this month.
      if (!parsed.length) {
        if (page > 1) {
          bootstrapComplete = true
          reachedDirectoryEnd = true
        }
        continue
      }

      const recent = parsed.filter((profile) => {
        const time = Date.parse(profile.activityAt || '')
        return Number.isFinite(time)
          && time >= cutoffDate().getTime()
          && time <= Date.now() + 48 * 60 * 60 * 1000
      })
      for (const profile of recent) byId.set(profile.id, profile)
    }

    if (reachedDirectoryEnd) break
  }

  if (!bootstrapComplete && lastHistoricalPage >= MAX_INDEX_PAGE) bootstrapComplete = true

  const newest = [...byId.values()]
    .sort((a, b) => Date.parse(b.activityAt || '') - Date.parse(a.activityAt || ''))[0]
  return {
    profiles: [...byId.values()],
    fetched,
    pages: pagesRead,
    cursor: {
      ...cursor,
      sourceKey: SOURCE_KEY,
      lastSeenProfileId: newest?.id.replace(`web-${SOURCE_KEY}-`, '') || cursor.lastSeenProfileId,
      lastSeenUrl: newest?.url || cursor.lastSeenUrl,
      lastSeenUpdatedAt: newest?.activityAt || cursor.lastSeenUpdatedAt,
      // Re-read the last historical page once while backfilling because newest-
      // first pages can shift. Once complete, store a sentinel beyond the hard
      // cap so legacy premature-complete cursors are distinguishable forever.
      backfillPage: bootstrapComplete
        ? MAX_INDEX_PAGE + 1
        : Math.max(2, lastHistoricalPage),
      bootstrapComplete,
      lastSuccessAt: new Date().toISOString(),
    },
  }
}

export function hiringUzJobsSourceHandles(): string[] {
  return process.env.HIRING_UZJOBS_CV_SOURCE === 'off' ? [] : [`web:${SOURCE_KEY}`]
}

export function listUzJobsSources(): Array<{ key: string; label: string; country: string }> {
  return [{ key: SOURCE_KEY, label: SOURCE_LABEL, country: 'UZ' }]
}

export async function crawlUzJobsSource() {
  const cursor = (await loadWebCursors()).get(SOURCE_KEY) || emptyWebCursor(SOURCE_KEY)
  return fetchProfiles(cursor)
}

export async function refreshHiringUzJobsSource(
  handle: string,
): Promise<{ fetched: number; candidates: number; stored: number } | null> {
  if (!hiringUzJobsSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())) return null
  const checkedAt = new Date().toISOString()
  const startedAt = Date.now()
  const cursor = (await loadWebCursors()).get(SOURCE_KEY) || emptyWebCursor(SOURCE_KEY)

  try {
    const result = await fetchProfiles(cursor)
    const activities = result.profiles.map((profile) => profile.activityAt || '').filter(Boolean).sort()
    const diagnostic: WebSourceDiagnostic = {
      handle: `web:${SOURCE_KEY}`,
      key: SOURCE_KEY,
      label: SOURCE_LABEL,
      country: 'UZ',
      status: result.profiles.length ? 'ok' : 'empty',
      fetched: result.fetched,
      candidates: result.profiles.length,
      pages: result.pages,
      blocks: result.fetched,
      parsed: result.profiles.length,
      rejected: Math.max(0, result.fetched - result.profiles.length),
      duplicate: 0,
      expired: 0,
      shown: 0,
      fetchDurationMs: Date.now() - startedAt,
      newestActivityAt: activities.at(-1) || null,
      oldestActivityAt: activities[0] || null,
      lastSeenProfileId: result.cursor.lastSeenProfileId,
      lastSuccessAt: result.cursor.lastSuccessAt,
      reachedCursor: false,
      checkedAt,
    }
    const persisted = await persistWebProfiles(result.profiles, diagnostic, SOURCE_KEY)
    diagnostic.shown = persisted.shown
    diagnostic.expired = persisted.expired
    recordWebDiagnostic(diagnostic)
    await saveWebCursor(result.cursor)
    console.log(
      `[hiring:web] ${SOURCE_KEY} pages=${result.pages} fetched=${result.fetched}`
      + ` candidates=${result.profiles.length} shown=${persisted.shown} store=${persisted.stored}`,
    )
    return { fetched: result.fetched, candidates: result.profiles.length, stored: persisted.stored }
  } catch (error) {
    const diagnostic: SourceRun = {
      handle: `web:${SOURCE_KEY}`,
      country: 'UZ',
      status: 'error',
      fetched: 0,
      candidates: 0,
      checkedAt,
      error: (error as Error).message,
    }
    // persistWebProfiles owns durable successful runs; errors still need the
    // source_runs trail so the UI can distinguish a broken source from no CVs.
    recordWebDiagnostic({
      ...diagnostic,
      key: SOURCE_KEY,
      label: SOURCE_LABEL,
      pages: 0,
      blocks: 0,
      parsed: 0,
      rejected: 0,
      duplicate: 0,
      expired: 0,
      shown: 0,
      fetchDurationMs: Date.now() - startedAt,
      newestActivityAt: null,
      oldestActivityAt: null,
      lastSeenProfileId: cursor.lastSeenProfileId,
      lastSuccessAt: cursor.lastSuccessAt,
      reachedCursor: false,
    })
    if (hiringDbEnabled()) await saveDbCandidates([], diagnostic)
    throw error
  }
}