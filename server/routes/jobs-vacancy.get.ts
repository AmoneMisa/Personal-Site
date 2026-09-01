// Same-origin BFF for vacancy detail reads owned by backend-platform.
import { requirePlatformGet } from '../utils/backendPlatformProxy'

export default defineEventHandler((event) => requirePlatformGet(event, 'vacancies', '/jobs-vacancy'))
