import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchRss } from '../server/utils/sources.ts'

test('We Work Remotely RSS vacancies stay remote without relying on title text', async () => {
  const previousDefaults = process.env.RSS_DEFAULTS
  const previousFeeds = process.env.RSS_FEEDS
  const previousFetch = globalThis.fetch

  process.env.RSS_DEFAULTS = 'off'
  process.env.RSS_FEEDS =
    'wwr-support|https://weworkremotely.com/categories/remote-customer-support-jobs.rss'
  globalThis.fetch = async () =>
    new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <rss><channel><item>
        <title>Acme: Customer Care Specialist</title>
        <link>https://weworkremotely.com/remote-jobs/acme-customer-care-specialist</link>
        <guid>wwr-123</guid>
        <pubDate>Thu, 27 Aug 2026 10:00:00 GMT</pubDate>
        <region>Anywhere in the World</region>
        <category>Customer Support</category>
        <description><![CDATA[Help customers by chat and email.]]></description>
      </item></channel></rss>`, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    })

  try {
    const jobs = await fetchRss('')
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Customer Care Specialist')
    assert.equal(jobs[0].company, 'Acme')
    assert.equal(jobs[0].remote, true)
    assert.equal(jobs[0].workMode, 'remote')
    assert.equal(jobs[0].location, 'Anywhere in the World')
    assert.deepEqual(jobs[0].tags, ['wwr-support', 'Customer Support'])
    assert.equal(jobs[0].description, 'Help customers by chat and email.')
  } finally {
    globalThis.fetch = previousFetch
    if (previousDefaults == null) delete process.env.RSS_DEFAULTS
    else process.env.RSS_DEFAULTS = previousDefaults
    if (previousFeeds == null) delete process.env.RSS_FEEDS
    else process.env.RSS_FEEDS = previousFeeds
  }
})

test('default RSS targets include each official service-oriented WWR category', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../server/utils/standardJobSourceTargets.ts', import.meta.url), 'utf8'),
  )

  assert.match(source, /remote-customer-support-jobs\.rss/)
  assert.match(source, /remote-sales-and-marketing-jobs\.rss/)
  assert.match(source, /remote-management-and-finance-jobs\.rss/)
  assert.match(source, /all-other-remote-jobs\.rss/)
})

test('job source selector names both built-in RSS providers', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../app/composables/jobs/useJobMeta.ts', import.meta.url), 'utf8'),
  )

  assert.match(source, /DOU\.ua \+ We Work Remotely/)
})
