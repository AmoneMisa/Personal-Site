// Same-origin BFF for the isolated CV API in backend-platform.
import { requirePlatformGet } from '../utils/backendPlatformProxy'

export default defineEventHandler((event) => requirePlatformGet(event, 'cv', '/hiring-feed'))
