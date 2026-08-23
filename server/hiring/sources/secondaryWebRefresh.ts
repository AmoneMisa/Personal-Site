import type { SourceRun } from '../../../shared/hiring/hiringDiagnostics'
import {
  enabledSecondaryWebSources,
  type SecondaryWebSourceKey,
} from '../../../shared/hiring/sources/secondaryWebSources'
import { hiringDbEnabled, saveDbCandidates } from '../../utils/hiringDb'
import { crawlSecondaryWebSource } from '../../utils/hiringSecondaryWebSources'
import { persistWebProfiles } from '../webProfilePersistence'

export { crawlSecondaryWebSource }

export async function refreshHiringSecondaryWebSource(
  handle: string,
): Promise<{ fetched: number; candidates: number; stored: number } | null> {
  const key = handle.replace(/^web:/i, '').toLowerCase() as SecondaryWebSourceKey
  const source = enabledSecondaryWebSources().find((item) => item.key === key)
  if (!source) return null

  const checkedAt = new Date().toISOString()

  try {
    const result = await crawlSecondaryWebSource(key)
    const diagnostic: SourceRun = {
      handle: `web:${key}`,
      country: source.country,
      status: result.profiles.length ? 'ok' : 'empty',
      fetched: result.fetched,
      candidates: result.profiles.length,
      checkedAt,
    }
    const persisted = await persistWebProfiles(result.profiles, diagnostic, key)
    console.log(
      `[hiring:web] ${key} fetched=${result.fetched}`
      + ` candidates=${result.profiles.length} store=${persisted.stored}`,
    )
    return {
      fetched: result.fetched,
      candidates: result.profiles.length,
      stored: persisted.stored,
    }
  } catch (error) {
    const diagnostic: SourceRun = {
      handle: `web:${key}`,
      country: source.country,
      status: 'error',
      fetched: 0,
      candidates: 0,
      checkedAt,
      error: (error as Error).message,
    }
    if (hiringDbEnabled()) await saveDbCandidates([], diagnostic)
    throw error
  }
}
