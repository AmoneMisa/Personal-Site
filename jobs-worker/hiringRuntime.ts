import { hiringChannelHandles } from '../server/utils/hiringSources'
import { refreshHiringChannel } from '../server/utils/hiringStore'
import { hiringWebSourceHandles, refreshHiringWebSource } from '../server/utils/hiringWebSources'
import { hiringIshBorSourceHandles, refreshHiringIshBorSource } from '../server/utils/hiringIshBorSource'
import {
  hiringSecondaryWebSourceHandles,
  refreshHiringSecondaryWebSource,
} from '../server/utils/hiringSecondaryWebSources'
import { refreshHiringUzJobsSource } from '../server/utils/hiringUzJobsSource'
import { hiringSocialSourceHandles, refreshHiringSocialSource } from '../server/utils/hiringSocialSources'
import { hiringLinkedInSourceHandles, refreshHiringLinkedInSource } from '../server/utils/hiringLinkedInSources'
import { hiringUzJobsSourceHandles } from '../shared/hiring/sources/uzJobsSource'

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
