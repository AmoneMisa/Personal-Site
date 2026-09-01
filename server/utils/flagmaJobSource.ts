import {
  crawlStandardJobBoard,
  enrichStandardJobBoardDetails,
  STANDARD_JOB_BOARD_CRAWL_POLICY,
} from './cyclicJobBoardCrawler'
import {
  parseFlagmaVacancies,
  parseFlagmaVacancyDetail,
  type FlagmaJobBoardDescriptor,
} from './extraPublicJobSources'
import type { Job } from './jobTypes'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export const FLAGMA_JOB_BOARD_TARGET_PREFIX = 'flagma-job-board:'

type FlagmaBoard = FlagmaJobBoardDescriptor & {
  key: string
}

export const FLAGMA_JOB_BOARDS: FlagmaBoard[] = [
  {
    key: 'ro',
    label: 'Flagma RO',
    url: 'https://flagma.ro/ru/vacancies/',
    country: 'RO',
  },
  {
    key: 'uz',
    label: 'Flagma UZ',
    url: 'https://flagma.uz/ru/vacancies/',
    country: 'UZ',
  },
]

function targetName(key: string): string {
  return `${FLAGMA_JOB_BOARD_TARGET_PREFIX}${key}`
}

function targetKey(target: string): string {
  return target.slice(FLAGMA_JOB_BOARD_TARGET_PREFIX.length)
}

export function configuredFlagmaJobBoardTargets(): string[] {
  return FLAGMA_JOB_BOARDS.map((board) => targetName(board.key))
}

export function isFlagmaJobBoardTarget(target: string): boolean {
  return target.startsWith(FLAGMA_JOB_BOARD_TARGET_PREFIX)
}

function pageUrl(board: FlagmaBoard, page: number): string {
  if (page <= 1) return board.url
  return `${board.url.replace(/\/+$/, '')}/page-${page}/`
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru,en;q=0.8',
    },
    signal,
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  return response.text()
}

async function crawlFlagmaBoard(board: FlagmaBoard): Promise<Job[]> {
  const run = await crawlStandardJobBoard({
    key: `flagma:${board.key}`,
    fetchPage: (page) => fetchText(
      pageUrl(board, page),
      AbortSignal.timeout(STANDARD_JOB_BOARD_CRAWL_POLICY.requestTimeoutMs),
    ),
    parsePage: (html) => parseFlagmaVacancies(html, board),
  })

  const jobs = await enrichStandardJobBoardDetails({
    key: `flagma:${board.key}`,
    jobs: run.jobs,
    fetchDetail: (job, signal) => fetchText(job.url, signal),
    parseDetail: parseFlagmaVacancyDetail,
  })

  console.log(
    `[jobs] Flagma ${board.country} pages=${run.pages.join(',')} jobs=${jobs.length} `
    + `cycle=${run.cycle} reachedEnd=${run.reachedEnd}`,
  )
  return jobs
}

export async function fetchFlagmaJobBoardTarget(target: string): Promise<Job[]> {
  if (!isFlagmaJobBoardTarget(target)) throw new Error(`Unknown Flagma job-board target ${target}`)
  const key = targetKey(target)
  const board = FLAGMA_JOB_BOARDS.find((item) => item.key === key)
  if (!board) throw new Error(`Unknown Flagma job board ${key}`)
  return crawlFlagmaBoard(board)
}
