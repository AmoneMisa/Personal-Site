import type { Job } from './jobTypes'

const REPO = 'NotifyYouInc/2026-H1B-Sponsor-Jobs'
const API = `https://api.github.com/repos/${REPO}`
const RAW = `https://raw.githubusercontent.com/${REPO}`
const REQUEST_TIMEOUT_MS = 12_000
const DEFAULT_MAX_JOBS = 80
const DEFAULT_RECENT_COMMITS = 2

interface GitHubCommitRef {
  sha: string
}

interface GitHubCommitFile {
  filename: string
  status: string
}

interface GitHubCommitDetail {
  sha: string
  files?: GitHubCommitFile[]
}

function headers(accept = 'application/vnd.github+json'): Record<string, string> {
  const token = process.env.USA_VISA_GITHUB_TOKEN?.trim()
  return {
    Accept: accept,
    'User-Agent': 'whiteslove-job-finder/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`GitHub H1B feed -> ${response.status}`)
  return response.json() as Promise<T>
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'whiteslove-job-finder/1.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`GitHub H1B raw -> ${response.status}`)
  return response.text()
}

function field(markdown: string, name: string): string | undefined {
  const match = markdown.match(new RegExp(`\\|\\s*${name}\\s*\\|\\s*([^\\n|]+)`, 'i'))
  return match?.[1]?.trim()
}

function markdownLinkText(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
  return match?.[1]?.trim() || value.trim()
}

function markdownLinkUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = value.match(/\]\((https?:\/\/[^)]+)\)/)
  return match?.[1]?.trim()
}

function postedAt(value: string | undefined): string {
  const parsed = Date.parse(value || '')
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString()
}

function isUsLocation(value: string): boolean {
  return /\bunited states\b|\busa\b|\bu\.s\.?\b|\bUS(?:\s+remote)?\b|\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i.test(value)
}

function parseJob(markdown: string, filename: string): Job | null {
  const heading = markdown.match(/^#\s+(.+?)\s+at\s+(.+)$/m)
  const companyField = field(markdown, 'Company')
  const title = heading?.[1]?.trim()
  const company = markdownLinkText(companyField) || heading?.[2]?.trim()
  const location = field(markdown, 'Location') || ''
  const category = field(markdown, 'Category') || undefined
  const applyUrl = markdownLinkUrl(field(markdown, 'Apply'))

  if (!title || !company || !applyUrl || !isUsLocation(location)) return null

  const evidence = 'Current opening from a company included in the 2026 H1B Sponsor Jobs feed; sponsorship for this exact role is not guaranteed.'

  return {
    id: `h1b-github-${filename.replace(/[^a-z0-9_-]+/gi, '-')}`,
    title,
    company,
    location,
    url: applyUrl,
    applyUrl,
    source: 'companies',
    remote: /remote|work from home|wfh/i.test(`${title} ${location}`),
    tags: ['H1B Sponsor Feed', 'H1B sponsor history', 'USA', category].filter(Boolean) as string[],
    postedAt: postedAt(field(markdown, 'Posted')),
    description: evidence,
    sponsorshipConfidence: 'historical',
    sponsorshipEvidence: [evidence],
  }
}

function maxJobs(): number {
  const parsed = Number.parseInt(process.env.USA_VISA_GITHUB_MAX_JOBS || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : DEFAULT_MAX_JOBS
}

function recentCommits(): number {
  const parsed = Number.parseInt(process.env.USA_VISA_GITHUB_RECENT_COMMITS || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 5) : DEFAULT_RECENT_COMMITS
}

async function recentJobFiles(limit: number): Promise<{ sha: string, filename: string }[]> {
  const commits = await fetchJson<GitHubCommitRef[]>(`${API}/commits?per_page=${recentCommits()}`)
  const seen = new Set<string>()
  const files: { sha: string, filename: string }[] = []

  for (const commit of commits) {
    if (!commit?.sha) continue
    const detail = await fetchJson<GitHubCommitDetail>(`${API}/commits/${encodeURIComponent(commit.sha)}`)

    for (const file of detail.files || []) {
      if (file.status === 'removed') continue
      if (!/^jobs\/[^/]+\.md$/i.test(file.filename)) continue
      if (file.filename.endsWith('/.gitkeep')) continue
      if (seen.has(file.filename)) continue

      seen.add(file.filename)
      files.push({ sha: detail.sha || commit.sha, filename: file.filename })
      if (files.length >= limit) return files
    }
  }

  return files
}

async function loadFile(file: { sha: string, filename: string }): Promise<Job | null> {
  const encodedPath = file.filename.split('/').map(encodeURIComponent).join('/')
  const markdown = await fetchText(`${RAW}/${encodeURIComponent(file.sha)}/${encodedPath}`)
  return parseJob(markdown, file.filename)
}

export async function fetchUsaVisaSponsorJobs(q: string): Promise<Job[]> {
  if (process.env.USA_VISA_SPONSOR_SOURCE === 'off') return []

  try {
    const files = await recentJobFiles(maxJobs())
    const results = await Promise.allSettled(files.map(loadFile))
    const byUrl = new Map<string, Job>()

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue
      byUrl.set(result.value.url, result.value)
    }

    const jobs = [...byUrl.values()]
    if (!q) return jobs

    const needle = q.toLocaleLowerCase('en')
    return jobs.filter((job) =>
      `${job.title} ${job.company} ${job.location} ${job.description || ''}`
        .toLocaleLowerCase('en')
        .includes(needle),
    )
  } catch (error) {
    console.warn('[jobs] USA H1B sponsor feed failed:', error instanceof Error ? error.message : String(error))
    return []
  }
}
