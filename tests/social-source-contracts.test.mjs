import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const jobs = await readFile(new URL('../server/utils/socialJobSources.ts', import.meta.url), 'utf8')
const hiring = await readFile(new URL('../server/utils/hiringSocialSources.ts', import.meta.url), 'utf8')
const linkedin = await readFile(new URL('../server/utils/hiringLinkedInSources.ts', import.meta.url), 'utf8')
const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8')

test('Threads vacancy discovery uses the shared keyword-search contract', () => {
  assert.match(jobs, /source:\s*'threads',\s*mode:\s*'search',\s*query:/)
  assert.match(jobs, /THREADS_REQUEST_TIMEOUT_MS/)
  assert.match(jobs, /if \(platform === 'threads'\)/)
  assert.match(jobs, /for \(const target of targets\)/)
})

test('candidate social discovery uses the same Threads search proxy', () => {
  assert.match(hiring, /source:\s*'threads',\s*mode:\s*'search',\s*query:/)
  assert.match(envExample, /HIRING_SOCIAL_API_URL=http:\/\/flat-finder-backend:4000\/internal\/social\/fetch/)
})

test('LinkedIn candidate discovery requests the dedicated public candidate mode', () => {
  assert.match(linkedin, /source:\s*'linkedin'/)
  assert.match(linkedin, /mode:\s*'candidates'/)
  assert.match(linkedin, /scope:\s*target\.scope/)
})
