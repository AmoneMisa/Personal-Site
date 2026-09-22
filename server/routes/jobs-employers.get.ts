// Same-origin BFF for employer collections: companies with two or more
// different live roles. Mirrors flats-owners for the jobs board.
import { requirePlatformGet } from '../utils/backendPlatformProxy'

export default defineEventHandler((event) => requirePlatformGet(event, 'vacancies', '/jobs-employers'))
