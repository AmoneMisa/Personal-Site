// GET /hiring-meta — country/city metadata for the hiring page filters.

import { HIRING_COUNTRIES } from '../utils/hiringSources'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
  return HIRING_COUNTRIES
})
