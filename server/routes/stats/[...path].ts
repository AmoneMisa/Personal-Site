// Same-origin proxy for the self-hosted Umami instance (docker-compose `umami`).
// The browser only ever sees /stats/*, so the internal service address stays
// private and the dashboard/API are not exposed: only the tracker script and
// its event collector are forwarded.
const ALLOWED: Record<string, string> = {
  'script.js': 'GET',
  'api/send': 'POST',
}

export default defineEventHandler((event) => {
  const base = String(process.env.UMAMI_URL || '').trim().replace(/\/$/, '')
  const path = getRouterParam(event, 'path') || ''
  if (!base || ALLOWED[path] !== event.method) throw createError({ statusCode: 404 })

  return proxyRequest(event, `${base}/${path}`)
})
