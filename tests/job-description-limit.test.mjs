import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sources = await readFile(new URL('../server/utils/sources.ts', import.meta.url), 'utf8')
const telegramTargets = await readFile(new URL('../server/utils/telegramJobTargets.ts', import.meta.url), 'utf8')
const standardTargets = await readFile(new URL('../server/utils/standardJobSourceTargets.ts', import.meta.url), 'utf8')

test('vacancy descriptions are not capped before enrichment', () => {
  for (const source of [sources, telegramTargets, standardTargets]) {
    assert.doesNotMatch(source, /const\s+DESC_MAX\s*=\s*4000\b/)
    assert.match(source, /const\s+DESC_MAX\s*=\s*Number\.POSITIVE_INFINITY/)
  }
})
