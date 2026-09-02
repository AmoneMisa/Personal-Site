// Same-origin BFF for the isolated vacancies API in backend-platform.
import { requirePlatformGet } from '../utils/backendPlatformProxy'

export default defineEventHandler((event) => requirePlatformGet(event, 'vacancies', '/jobs-feed'))
