import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('candidate snapshot validation imports the domain parser directly', async () => {
  const source = await read('server/hiring/application/candidateSnapshotWriter.ts')
  assert.match(source, /from '\.\.\/domain\/telegramCandidateParser'/u)
  assert.doesNotMatch(source, /from '\.\.\/\.\.\/utils\/hiringSources'/u)
})

test('social candidate ingestion imports the domain parser directly', async () => {
  const source = await read('server/hiring/sources/socialRefresh.ts')
  assert.match(source, /from '\.\.\/domain\/telegramCandidateParser'/u)
  assert.doesNotMatch(source, /from '\.\.\/\.\.\/utils\/hiringSources'/u)
})

test('Telegram transport no longer acts as a parser facade', async () => {
  const source = await read('server/utils/hiringSources.ts')
  assert.doesNotMatch(source, /export \{[^}]*isLikelyCvPost[^}]*\} from/u)
  assert.doesNotMatch(source, /export \{[^}]*detectCity[^}]*\} from/u)
  assert.match(source, /classifyTelegramMessage/u)
  assert.match(source, /telegramMessageToProfile/u)
})
