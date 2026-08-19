import { refreshHiringStore } from '~~/server/utils/hiringStore'

export default defineTask({
  meta: {
    name: 'hiring:refresh',
    description: 'Pull candidate CV/resume profiles from Telegram resume channels',
  },
  async run() {
    const summary = await refreshHiringStore()
    console.log(`[hiring:refresh] fetched=${summary.fetched} stored=${summary.stored}`)
    return { result: summary }
  },
})
