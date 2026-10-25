import { canonicalIndexablePath } from '../utils/canonicalPath'

// /ABOUT and /about/ render the same page as /about. Redirect them so crawlers
// see one URL per page instead of relying on the canonical tag alone.
export default defineEventHandler((event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return

  const [pathname = '', ...rest] = event.path.split('?')
  const target = canonicalIndexablePath(pathname)
  if (!target) return

  const search = rest.length ? `?${rest.join('?')}` : ''
  return sendRedirect(event, `${target}${search}`, 301)
})
