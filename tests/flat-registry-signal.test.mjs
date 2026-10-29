import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { registrySignalOf, registrySourcesOf, registryText } from '../app/utils/flats/registrySignal.ts'

test('only the three known categories are accepted', () => {
  for (const value of ['hidden_agent', 'flagged', 'trusted']) assert.equal(registrySignalOf(value), value)
  for (const value of ['risk', '', null, undefined, 3, {}]) assert.equal(registrySignalOf(value), null)
})

test('sources: public http(s) links only, by host, deduplicated, at most three', () => {
  const sources = registrySourcesOf([
    'https://www.olx.uz/d/obyavlenie/a', 'https://www.olx.uz/d/obyavlenie/a', 'javascript:alert(1)', 'tg://resolve?phone=1',
    'not a url', 42, 'http://krisha.kz/a/show/1', 'https://lalafo.kg/x', 'https://extra.example/4',
  ])
  assert.deepEqual(sources.map((source) => source.host), ['olx.uz', 'krisha.kz', 'lalafo.kg'])
  assert.ok(sources.every((source) => /^https?:/.test(source.href)))
  assert.deepEqual(registrySourcesOf(undefined), [])
})

test('the wording is about the listing contact and never calls a person a fraudster', () => {
  for (const locale of ['ru', 'en']) {
    const text = registryText(locale)
    for (const key of ['hidden_agent', 'flagged', 'trusted']) {
      assert.match(text[key], /(контакт|contact)/i)
      assert.doesNotMatch(text[key], /(мошенник|scam|fraud|обман)/i)
    }
    assert.ok(text.caveat.length > 0)
  }
})

test('the modal shows the note under the contact buttons', async () => {
  const page = await readFile(new URL('../app/pages/flat-finder/[...slug].vue', import.meta.url), 'utf8')
  assert.match(page, /<FlatRegistryNote[^>]*:signal="active\.registrySignal"[^>]*:sources="active\.registrySources"/)
})
