// Same-origin BFF for CV filter metadata in backend-platform.
import { requirePlatformGet } from '../utils/backendPlatformProxy'

export default defineEventHandler((event) => requirePlatformGet(event, 'cv', '/hiring-meta'))
