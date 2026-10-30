// GET /hiring-photo?path=/api/tg-photo/<channel>/<id> — see server/utils/photoProxy.ts.
import { proxyTelegramPhoto } from '../utils/photoProxy'

export default defineEventHandler(proxyTelegramPhoto)
