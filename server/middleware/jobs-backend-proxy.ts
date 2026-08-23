import { getRequestURL, proxyRequest } from 'h3'

function isJobsBackendPath(pathname: string): boolean {
  return pathname.startsWith('/jobs-')
    || pathname.startsWith('/hiring-')
    || pathname.startsWith('/internal/jobs-')
    || pathname.startsWith('/internal/hiring-')
}

export default defineEventHandler((event) => {
  // The dedicated jobs-backend container uses the same built image but executes
  // the real jobs/hiring routes locally. The public frontend never executes
  // scraping, queue orchestration, candidate normalization or search indexing.
  if (String(process.env.JOBS_EXECUTION_ENABLED || 'off').toLowerCase() === 'on') return

  const url = getRequestURL(event)
  if (!isJobsBackendPath(url.pathname)) return

  const backend = String(process.env.JOBS_BACKEND_URL || 'http://jobs-backend:3000').replace(/\/$/, '')
  return proxyRequest(event, `${backend}${url.pathname}${url.search}`)
})
