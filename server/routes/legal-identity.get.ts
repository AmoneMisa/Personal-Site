import { readLegalIdentity } from '~~/shared/legal/legalIdentity'

// Operator identity for the legal pages. Values come from the deployment
// environment; the list of missing variable names is returned so a page can
// say that it still requires operator review.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  return readLegalIdentity(process.env)
})
