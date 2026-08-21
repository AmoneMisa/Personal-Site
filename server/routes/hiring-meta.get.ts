// GET /hiring-meta — country/city metadata for the hiring page filters.

import { HIRING_COUNTRIES } from '../utils/hiringSources'

const EXTRA_COUNTRIES = [
  { code: 'RO', name: 'Romania', currency: 'RON', cities: ['Bucharest', 'Cluj-Napoca', 'Iasi', 'Timisoara', 'Brasov'] },
  // Candidate-focused UA feeds sometimes contain Ukrainians currently abroad.
  // Keep their actual current location instead of silently forcing `UA` from
  // the channel metadata.
  { code: 'CA', name: 'Canada', currency: 'CAD', cities: [] },
  { code: 'US', name: 'United States', currency: 'USD', cities: [] },
] as const

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
  return [...HIRING_COUNTRIES, ...EXTRA_COUNTRIES]
})
