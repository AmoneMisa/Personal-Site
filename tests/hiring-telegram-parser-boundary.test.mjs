import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const RUNTIME = 'server/hiring/sources/telegramRuntime.ts'

test('Telegram candidate parsing is owned by the domain module', async () => {
  const runtime = await read(RUNTIME)
  const parser = await read('server/hiring/domain/telegramCandidateParser.ts')

  assert.match(runtime, /telegramCandidateParser/u)
  assert.match(runtime, /classifyTelegramMessage/u)
  assert.match(runtime, /telegramMessageToProfile/u)
  assert.doesNotMatch(runtime, /const ROLE_RE\b/u)
  assert.doesNotMatch(runtime, /const UZ_CANDIDATE_MARKER_RE\b/u)
  assert.doesNotMatch(runtime, /function parseSalary\(/u)
  assert.doesNotMatch(runtime, /function parseExperience\(/u)

  assert.match(parser, /export function isLikelyCvPost\(/u)
  assert.match(parser, /export function detectCity\(/u)
  assert.match(parser, /export function detectDistrict\(/u)
  assert.match(parser, /export function telegramMessageToProfile\(/u)
  assert.match(parser, /export function classifyTelegramMessage\(/u)
})

test('Telegram transport is not a compatibility facade for domain parsing', async () => {
  const runtime = await read(RUNTIME)
  assert.doesNotMatch(runtime, /export \{[^}]*detectCity[^}]*\} from/u)
  assert.doesNotMatch(runtime, /export \{[^}]*detectDistrict[^}]*\} from/u)
  assert.doesNotMatch(runtime, /export \{[^}]*isLikelyCvPost[^}]*\} from/u)
})
