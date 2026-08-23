import { getRequestURL, proxyRequest } from 'h3'

function isJobsApiPath(pathname: string): boolean {
  return pathname.startsWith('/jobs-')
    || pathname.startsWith('/hiring-')
    || pathname.startsWith('/internal/jobs-')
    || pathname.startsWith('/internal/hiring-')
}

export default defineEventHandler((event) => {
  // Only the public renderer proxies these routes. jobs-api serves them locally;
  // jobs-worker is a standalone process and never starts Nitro at all.
  if (String(process.env.JOBS_RUNTIME_ROLE || 'frontend').toLowerCase() !== 'frontend') return

  const url = getRequestURL(event)
  if (!isJobsApiPath(url.pathname)) return

  const api = String(process.env.JOBS_API_URL || 'http://jobs-api:3000').replace(/\/$/, '')
  return proxyRequest(event, `${api}${url.pathname}${url.search}`)
})
