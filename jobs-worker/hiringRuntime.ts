import { hiringChannelHandles } from '../server/utils/hiringSources'
import { refreshHiringChannel } from '../server/utils/hiringStore'
import { refreshHiringWebSource } from '../server/utils/hiringWebSources'
import { refreshHiringIshBorSource } from '../server/utils/hiringIshBorSource'
import { refreshHiringSecondaryWebSource } from '../server/utils/hiringSecondaryWebSources'
import { refreshHiringUzJobsSource } from '../server/utils/hiringUzJobsSource'
import { refreshHiringSocialSource } from '../server/utils/hiringSocialSources'
import { refreshHiringLinkedInSource } from '../server/utils/hiringLinkedInSources'
import { hiringIshBorSourceHandles } from '../shared/hiring/sources/ishBorSource'
import { hiringUzJobsSourceHandles } from '../shared/hiring/sources/uzJobsSource'
import { hiringSocialSourceHandles } from '../shared/hiring/sources/socialSources'
import { hiringLinkedInSourceHandles } from '../shared/hiring/sources/linkedInSources'
import { hiringSecondaryWebSourceHandles } from '../shared/hiring/sources/secondaryWebSources'
import { hiringWebSourceHandles } from '../shared/hiring/sources/webCvSources'

type HiringAdapter = {
  handles: () => string[]
  refresh: (handle: string) => Promise<unknown>
}

const refreshAdapters: HiringAdapter[] = [
  { handles: hiringLinkedInSourceHandles, refresh: refreshHiringLinkedInSource },
  { handles: hiringSocialSourceHandles, refresh: refreshHiringSocialSource },
  { handles: hiringIshBorSourceHandles, refresh: refreshHiringIshBorSource },
  { handles: hiringUzJobsSourceHandles, refresh: refreshHiringUzJobsSource },
  { handles: hiringSecondaryWebSourceHandles, refresh: refreshHiringSecondaryWebSource },
  { handles: hiringWebSourceHandles, refresh: refreshHiringWebSource },
  { handles: hiringChannelHandles, refresh: refreshHiringChannel },
]

function hasHandle(handles: string[], normalized: string): boolean {
  return handles.some((item) => item.toLowerCase() === normalized)
}

export function allHiringTargets() {
  const telegramHandles = hiringChannelHandles()
  const progressiveWebHandles = [
    ...hiringWebSourceHandles(),
    ...hiringIshBorSourceHandles(),
    ...hiringUzJobsSourceHandles(),
  ]
  const hiringHandles = [
    ...telegramHandles,
    ...progressiveWebHandles,
    ...hiringSecondaryWebSourceHandles(),
    ...hiringSocialSourceHandles(),
    ...hiringLinkedInSourceHandles(),
  ]

  return { telegramHandles, progressiveWebHandles, hiringHandles }
}

export async function refreshHiringTarget(rawHandle: string) {
  const handle = String(rawHandle || '').replace(/^@/, '')
  const normalized = handle.toLowerCase()
  const adapter = refreshAdapters.find(({ handles }) => hasHandle(handles(), normalized))

  if (!handle || !adapter) {
    throw new Error(`Unknown hiring source: ${handle || '<empty>'}`)
  }

  const result = await adapter.refresh(handle)
  if (!result) throw new Error(`Hiring source is disabled: ${handle}`)

  return { handle, ...(result as Record<string, unknown>) }
}
