// Same-origin BFF for one employer collection and its live postings.
import { requirePlatformGet } from '../utils/backendPlatformProxy'

export default defineEventHandler((event) => requirePlatformGet(event, 'vacancies', '/jobs-employer'))
