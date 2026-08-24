import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const RUNTIME = 'server/hiring/sources/telegramRuntime.ts'

test('Telegram runtime exposes only per-channel refresh, not legacy full-source fan-out', async () => {
  const source = await read(RUNTIME)
  const diagnostics = await read('server/hiring/sources/telegramDiagnostics.ts')

  assert.match(source, /export async function fetchHiringChannel\(/u)
  assert.match(diagnostics, /export function getHiringSourceDiagnostics\(/u)
  assert.doesNotMatch(source, /export async function fetchHiringTelegram\(/u)
  assert.doesNotMatch(source, /export async function fetchHiringSource\(/u)
  assert.doesNotMatch(source, /export function isHiringSourceConfigured\(/u)
  assert.doesNotMatch(source, /const FETCHERS\b/u)
  assert.doesNotMatch(source, /function fetchChannelViaWorker\(/u)
  assert.doesNotMatch(source, /TELEGRAM_PARALLEL_CHANNELS/u)
})

test('Telegram queue targets remain sourced from the canonical shared catalog', async () => {
  const runtime = await read(RUNTIME)
  const catalog = await read('shared/hiring/sources/telegramChannels.ts')

  assert.match(runtime, /HIRING_TELEGRAM_CHANNELS/u)
  assert.match(runtime, /hiringChannelHandles[\s\S]*?channel\.enabled\s*!==\s*false/u)
  assert.match(catalog, /export const HIRING_TELEGRAM_CHANNELS/u)
})
