import {
  enabledWebCvSources,
  type WebCvSourceKey,
} from '../../../shared/hiring/sources/webCvSources'
import { emptyWebCursor, loadWebCursors, saveWebCursor, type WebCursor } from '../../utils/hiringCursors'
import { hiringDbEnabled, saveDbCandidates } from '../../utils/hiringDb'
import { recordWebDiagnostic, type WebSourceDiagnostic } from '../../utils/hiringDiagnostics'
import {
  auditWebSource,
  crawlWebSource as crawlLegacyWebSource,
  listWebSources,
  type WebSourceAudit,
} from '../../utils/hiringWebSources'
import { persistWebProfiles } from '../webProfilePersistence'
import { crawlCareerist } from './web/careerist'
import { crawlFlagma, isFlagmaSource } from './web/flagma'

export { auditWebSource, listWebSources, type WebSourceAudit }

export async function crawlWebSource(key: string, cursor?: WebCursor) {
  if (isFlagmaSource(key)) return crawlFlagma(key, cursor)
  if (key === 'careerist-uz') return crawlCareerist(cursor)
  return crawlLegacyWebSource(key, cursor)
}

export async function refreshHiringWebSource(
  handle: string,
): Promise<{ fetched: number; stored: number; candidates: number } | null> {
  const key = handle.replace(/^web:/i, '').toLowerCase() as WebCvSourceKey
  const source = enabledWebCvSources().find((item) => item.key === key)
  if (!source) return null

  const checkedAt = new Date().toISOString()
  const startedAt = Date.now()
  const cursor = (await loadWebCursors()).get(source.key) || emptyWebCursor(source.key)

  try {
    const run = await crawlWebSource(source.key, cursor)
    const diagnostic: WebSourceDiagnostic = {
      handle: `web:${source.key}`,
      key: source.key,
      label: source.label,
      country: source.country,
      status: run.profiles.length ? 'ok' : 'empty',
      fetched: run.fetched,
      candidates: run.profiles.length,
      pages: run.pages,
      blocks: run.fetched,
      parsed: run.parsed,
      rejected: run.rejected,
      duplicate: run.duplicate,
      expired: 0,
      shown: 0,
      fetchDurationMs: Date.now() - startedAt,
      newestActivityAt: run.newestActivityAt,
      oldestActivityAt: run.oldestActivityAt,
      lastSeenProfileId: run.cursor.lastSeenProfileId,
      lastSuccessAt: run.cursor.lastSuccessAt,
      reachedCursor: run.reachedCursor,
      checkedAt,
    }

    const persisted = await persistWebProfiles(run.profiles, diagnostic, source.key)
    diagnostic.shown = persisted.shown
    diagnostic.expired = persisted.expired
    recordWebDiagnostic(diagnostic)
    await saveWebCursor(run.cursor)

    console.log(
      `[hiring:web] ${source.key} pages=${run.pages} blocks=${run.fetched} parsed=${run.parsed}`
      + ` rejected=${run.rejected} dup=${run.duplicate} shown=${persisted.shown} expired=${persisted.expired}`
      + ` cursor=${run.cursor.lastSeenProfileId || '-'}${run.reachedCursor ? ' (stopped at cursor)' : ''}`
      + ` store=${persisted.stored} in ${diagnostic.fetchDurationMs}ms`,
    )
    return { fetched: run.fetched, candidates: run.profiles.length, stored: persisted.stored }
  } catch (error) {
    const diagnostic: WebSourceDiagnostic = {
      handle: `web:${source.key}`,
      key: source.key,
      label: source.label,
      country: source.country,
      status: 'error',
      fetched: 0,
      candidates: 0,
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
      checkedAt,
      error: (error as Error).message,
    }
    recordWebDiagnostic(diagnostic)
    if (hiringDbEnabled()) await saveDbCandidates([], diagnostic)
    throw error
  }
}
