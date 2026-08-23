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
import { hiringTelegramChannelHandles } from '../shared/hiring/sources/telegramChannels'

export interface HiringRefreshAdapter {
  handles: () => string[]
  refresh: (handle: string) => Promise<unknown>
}

// Composition root: this is the only jobs-worker module that knows which
// concrete server refresh implementation backs each runtime-neutral source registry.
export const hiringRefreshAdapters: HiringRefreshAdapter[] = [
  { handles: hiringLinkedInSourceHandles, refresh: refreshHiringLinkedInSource },
  { handles: hiringSocialSourceHandles, refresh: refreshHiringSocialSource },
  { handles: hiringIshBorSourceHandles, refresh: refreshHiringIshBorSource },
  { handles: hiringUzJobsSourceHandles, refresh: refreshHiringUzJobsSource },
  { handles: hiringSecondaryWebSourceHandles, refresh: refreshHiringSecondaryWebSource },
  { handles: hiringWebSourceHandles, refresh: refreshHiringWebSource },
  { handles: hiringTelegramChannelHandles, refresh: refreshHiringChannel },
]
