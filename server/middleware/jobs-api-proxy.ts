import { getRequestURL, proxyRequest } from 'h3'

function isJobsApiPath(pathname: string): boolean {
  return pathname.startsWith('/jobs-') || pathname.startsWith('/hiring-')
}

export default defineEventHandler((event) => {
  // Only the public Nuxt renderer proxies these routes. jobs-api is another
  // Nuxt/Nitro process from the same Personal-Site image and serves them locally.
  // jobs-worker is a standalone Node process and never starts Nitro.
  if (String(process.env.JOBS_RUNTIME_ROLE || 'frontend').toLowerCase() !== 'frontend') return

  const url = getRequestURL(event)
  if (!isJobsApiPath(url.pathname)) return

  const api = String(process.env.JOBS_API_URL || 'http://jobs-api:3000').replace(/\/$/, '')
  return proxyRequest(event, `${api}${url.pathname}${url.search}`)
})
