import { useStateStore } from './stateStore'
import type { Job } from './jobTypes'

const CURSOR_VERSION = 1
const CURSOR_TTL_SECONDS = 30 * 86_400

interface JobBoardCursor {
  version: number
  nextPage: number
  cycle: number
  lastSuccessAt: string | null
}

export interface CyclicJobBoardRun {
  jobs: Job[]
  pages: number[]
  nextPage: number
  cycle: number
  reachedEnd: boolean
}

export interface CyclicJobBoardOptions {
  key: string
  pagesPerRun: number
  maxPage: number
  fetchPage: (page: number) => Promise<string>
  parsePage: (html: string, page: number) => Job[]
  requestDelayMs?: number
}

function defaultCursor(): JobBoardCursor {
  return {
    version: CURSOR_VERSION,
    nextPage: 2,
    cycle: 0,
    lastSuccessAt: null,
  }
}

function cursorKey(key: string): string {
  return `jobs:board-cursor:v${CURSOR_VERSION}:${key}`
}

async function loadCursor(key: string): Promise<JobBoardCursor> {
  const raw = await useStateStore().get(cursorKey(key))
  if (!raw) return defaultCursor()
  try {
    const parsed = JSON.parse(raw) as Partial<JobBoardCursor>
    return {
      version: CURSOR_VERSION,
      nextPage: Math.max(2, Number(parsed.nextPage) || 2),
      cycle: Math.max(0, Number(parsed.cycle) || 0),
      lastSuccessAt: typeof parsed.lastSuccessAt === 'string' ? parsed.lastSuccessAt : null,
    }
  } catch {
    return defaultCursor()
  }
}

async function saveCursor(key: string, cursor: JobBoardCursor): Promise<void> {
  await useStateStore().set(
    cursorKey(key),
    JSON.stringify(cursor),
    'EX',
    CURSOR_TTL_SECONDS,
  )
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

function dedupe(jobs: Job[]): Job[] {
  const byKey = new Map<string, Job>()
  for (const job of jobs) byKey.set(job.url || job.id, job)
  return [...byKey.values()]
}

/**
 * Refreshes page 1 on every run and rotates through older pages with a durable
 * cursor. Rotation intentionally never becomes permanently "complete": job
 * snapshots expire when a source has not re-seen them for a few days, so a
 * 14-day board window must be revisited continuously rather than backfilled
 * once and forgotten.
 */
export async function crawlCyclicJobBoard(options: CyclicJobBoardOptions): Promise<CyclicJobBoardRun> {
  const pagesPerRun = Math.max(1, Math.min(50, options.pagesPerRun))
  const maxPage = Math.max(2, Math.min(10_000, options.maxPage))
  const requestDelayMs = Math.max(0, Math.min(10_000, options.requestDelayMs || 0))
  const cursor = await loadCursor(options.key)
  const startPage = Math.min(maxPage, Math.max(2, cursor.nextPage))
  const historicalPages = Array.from(
    { length: Math.min(pagesPerRun, maxPage - startPage + 1) },
    (_, index) => startPage + index,
  )
  const pages = [1, ...historicalPages]
  const jobs: Job[] = []
  const readPages: number[] = []
  let nextPage = startPage
  let reachedEnd = false
  let failedHistoricalPage: number | null = null

  for (const page of pages) {
    if (readPages.length) await delay(requestDelayMs)
    try {
      const pageJobs = options.parsePage(await options.fetchPage(page), page)
      readPages.push(page)
      jobs.push(...pageJobs)

      if (page > 1) {
        if (!pageJobs.length) {
          reachedEnd = true
          break
        }
        nextPage = page + 1
        if (nextPage > maxPage) reachedEnd = true
      }
    } catch (error) {
      if (page === 1) throw error
      failedHistoricalPage = page
      console.warn(
        `[jobs] ${options.key} pagination paused at page ${page}:`,
        error instanceof Error ? error.message : String(error),
      )
      break
    }
  }

  if (failedHistoricalPage != null) nextPage = failedHistoricalPage
  const cycle = reachedEnd ? cursor.cycle + 1 : cursor.cycle
  if (reachedEnd) nextPage = 2

  await saveCursor(options.key, {
    version: CURSOR_VERSION,
    nextPage,
    cycle,
    lastSuccessAt: new Date().toISOString(),
  })

  return {
    jobs: dedupe(jobs),
    pages: readPages,
    nextPage,
    cycle,
    reachedEnd,
  }
}
