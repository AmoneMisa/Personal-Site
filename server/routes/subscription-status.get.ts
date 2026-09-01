export default defineEventHandler((event) => {
  const enabled = String(process.env.TELEGRAM_SUBSCRIPTION_BOT_ENABLED || 'off').toLowerCase() === 'on'
    && Boolean(String(process.env.TELEGRAM_SUBSCRIPTION_BOT_USERNAME || '').trim())
    && Boolean(String(process.env.SUBSCRIPTIONS_DATABASE_URL || '').trim())

  setResponseHeader(event, 'Cache-Control', 'private, max-age=30')
  return { enabled }
})
