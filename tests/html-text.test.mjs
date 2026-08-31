import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  absoluteHttpUrl,
  decodeHtmlEntities,
  htmlLines,
  stripHtml,
} from '../server/utils/htmlText.ts'

const jobsUa = await readFile(new URL('../server/utils/jobsUaSource.ts', import.meta.url), 'utf8')

test('HTML entity decoding handles named and numeric entities without invalid code points', () => {
  assert.equal(decodeHtmlEntities('A&nbsp;&amp;&#33;&#x21;'), 'A &!!')
  assert.equal(decodeHtmlEntities('bad: &#9999999999;'), 'bad: &#9999999999;')
})

test('HTML text extraction removes executable/style content and preserves readable boundaries', () => {
  assert.equal(
    stripHtml('<style>.x{display:none}</style><script>alert(1)</script><p>Hello<br>world &amp; friends</p>'),
    'Hello world & friends',
  )
  assert.deepEqual(
    htmlLines('<p>First</p><div>Second<br>line</div><script>ignored()</script>'),
    ['First', 'Second', 'line'],
  )
})

test('absoluteHttpUrl accepts only HTTP(S), decodes entities, and removes fragments', () => {
  assert.equal(
    absoluteHttpUrl('/jobs?a=1&amp;b=2#details', 'https://example.com/careers'),
    'https://example.com/jobs?a=1&b=2',
  )
  assert.equal(absoluteHttpUrl('javascript:alert(1)', 'https://example.com'), null)
})

test('Jobs.ua consumes the shared HTML helpers instead of maintaining a local decoder', () => {
  assert.match(jobsUa, /from '\.\/htmlText'/)
  assert.match(jobsUa, /decodeHtmlEntities as decodeEntities/)
  assert.doesNotMatch(jobsUa, /function decodeEntities\(/)
  assert.doesNotMatch(jobsUa, /function stripHtml\(/)
})
