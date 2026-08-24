import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const RUNTIME = 'server/hiring/sources/telegramRuntime.ts'

test('Telegram runtime uses the shared source catalog', async () => {
  const runtime = await read(RUNTIME)
  assert.match(runtime, /shared\/hiring\/sources\/telegramChannels/)
  assert.match(runtime, /HIRING_TELEGRAM_CHANNELS\.map/)
  assert.doesNotMatch(runtime, /const\s+DEFAULT_CV_CHANNELS/)
})

test('Telegram runtime no longer owns hiring market metadata', async () => {
  const runtime = await read(RUNTIME)
  assert.doesNotMatch(runtime, /export\s+const\s+HIRING_COUNTRIES/)
})

test('custom Telegram source override retains bounded supported country codes', async () => {
  const runtime = await read(RUNTIME)
  assert.match(runtime, /function\s+telegramCountry/)
  assert.match(runtime, /normalizedCountry\s*===\s*'UZ'/)
})
