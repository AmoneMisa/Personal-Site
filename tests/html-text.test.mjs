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
const regionalGeneral = await readFile(new URL('../server/utils/regionalGeneralEmployerSources.ts', import.meta.url), 'utf8')
const regionalService = await readFile(new URL('../server/utils/regionalServiceJobSources.ts', import.meta.url), 'utf8')
const ishBorCrawler = await readFile(new URL('../shared/hiring/sources/ishBorCrawler.ts', import.meta.url), 'utf8')
const aviationExpansion = await readFile(new URL('../server/utils/aviationExpansionJobs.ts', import.meta.url), 'utf8')
const extraPublic = await readFile(new URL('../server/utils/extraPublicJobSources.ts', import.meta.url), 'utf8')
const linkedIn = await readFile(new URL('../server/utils/linkedinSource.ts', import.meta.url), 'utf8')
const curatedRemote = await readFile(new URL('../server/utils/curatedRemoteJobSources.ts', import.meta.url), 'utf8')

test('HTML entity decoding handles named and numeric entities without invalid code points', () => {
  assert.equal(decodeHtmlEntities('A&nbsp;&amp;&#33;&#x21;'), 'A &!!')
  assert.equal(decodeHtmlEntities('bad: &#9999999999;'), 'bad: &#9999999999;')
})

test('HTML entity decoding covers punctuation, currencies, and case-sensitive Latin entities used by job boards', () => {
  assert.equal(
    decodeHtmlEntities('&Auml; &auml; &eacute; &hellip; &bull; &euro; &pound; &copy; &trade;'),
    'Ä ä é … • € £ © ™',
  )
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

test('regional employer sources reuse shared HTML and safe URL helpers', () => {
  for (const source of [regionalGeneral, regionalService]) {
    assert.match(source, /absoluteHttpUrl as absoluteUrl, stripHtml/)
    assert.doesNotMatch(source, /function decodeEntities\(/)
    assert.doesNotMatch(source, /function stripHtml\(/)
    assert.doesNotMatch(source, /function absoluteUrl\(/)
  }
})

test('IshBor crawler delegates URL normalization to the runtime-neutral helper', () => {
  assert.match(ishBorCrawler, /import \{ absoluteHttpUrl \} from '\.\.\/\.\.\/htmlText'/)
  assert.match(ishBorCrawler, /return absoluteHttpUrl\(raw, base\) \|\| base/)
  assert.doesNotMatch(ishBorCrawler, /new URL\(decodeEntities\(raw\), base\)/)
})

test('aviation sources reuse shared HTML and safe URL helpers', () => {
  assert.match(aviationExpansion, /absoluteHttpUrl as absoluteUrl, htmlLines, stripHtml/)
  assert.doesNotMatch(aviationExpansion, /function decodeEntities\(/)
  assert.doesNotMatch(aviationExpansion, /function stripHtml\(/)
  assert.doesNotMatch(aviationExpansion, /function htmlLines\(/)
  assert.doesNotMatch(aviationExpansion, /function absoluteUrl\(/)
})

test('public job boards reuse generic HTML mechanics while keeping Flagma row parsing local', () => {
  assert.match(extraPublic, /absoluteHttpUrl as absoluteUrl, decodeHtmlEntities, stripHtml/)
  assert.match(extraPublic, /function cardLines\(fragment: string\)/)
  assert.match(extraPublic, /return decodeHtmlEntities\(fragment\)/)
  assert.doesNotMatch(extraPublic, /function decodeEntities\(/)
  assert.doesNotMatch(extraPublic, /function stripHtml\(/)
  assert.doesNotMatch(extraPublic, /function absoluteUrl\(/)
})

test('LinkedIn reuses shared entity decoding while keeping paragraph semantics source-local', () => {
  assert.match(linkedIn, /import \{ decodeHtmlEntities \} from '\.\/htmlText'/)
  assert.match(linkedIn, /function linkedinText\(value: string \| undefined\)/)
  assert.match(linkedIn, /return decodeHtmlEntities\(/)
  assert.doesNotMatch(linkedIn, /function decodeEntities\(/)
  assert.doesNotMatch(linkedIn, /function stripHtml\(/)
})

test('curated remote boards reuse shared HTML mechanics while preserving HTTPS-only policy', () => {
  assert.match(curatedRemote, /import \{ absoluteHttpUrl, stripHtml \} from '\.\/htmlText'/)
  assert.match(curatedRemote, /const url = absoluteHttpUrl\(raw, base\)/)
  assert.match(curatedRemote, /url\?\.startsWith\('https:\/\/'\)/)
  assert.doesNotMatch(curatedRemote, /function decodeEntities\(/)
  assert.doesNotMatch(curatedRemote, /function stripHtml\(/)
  assert.doesNotMatch(curatedRemote, /new URL\(decodeEntities\(raw\), base\)/)
})
