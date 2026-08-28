import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRobotaUaPage, parseWorkUaPage } from '../server/utils/ukraineJobSources.ts'

const NOW = new Date('2026-08-28T12:00:00.000Z')

test('Work.ua public search cards become Ukraine board jobs', () => {
  const html = `
    <section>
      <a href="/jobs/1234567/">
        <h2>Frontend Developer</h2>
      </a>
      <div>Acme · Київ · віддалена робота · 60 000 грн</div>
      <p>Vue, TypeScript, REST API</p>
    </section>
  `

  const [job] = parseWorkUaPage(html, 'frontend', NOW)
  assert.ok(job)
  assert.equal(job.id, 'companies-workua-1234567')
  assert.equal(job.title, 'Frontend Developer')
  assert.equal(job.country, 'UA')
  assert.equal(job.source, 'companies')
  assert.equal(job.remote, true)
  assert.equal(job.url, 'https://www.work.ua/jobs/1234567/')
  assert.ok(job.tags.includes('Work.ua'))
  assert.equal(job.postedAt, NOW.toISOString())
})

test('robota.ua public search cards become Ukraine board jobs', () => {
  const html = `
    <article>
      <a href="/company123/vacancy9876543">
        <h2>React Developer</h2>
      </a>
      <div>Example · Львів · remote · 2 000 USD</div>
      <p>React, JavaScript, GraphQL</p>
    </article>
  `

  const [job] = parseRobotaUaPage(html, 'react', NOW)
  assert.ok(job)
  assert.equal(job.id, 'companies-robotaua-9876543')
  assert.equal(job.title, 'React Developer')
  assert.equal(job.country, 'UA')
  assert.equal(job.source, 'companies')
  assert.equal(job.remote, true)
  assert.equal(job.url, 'https://robota.ua/company123/vacancy9876543')
  assert.ok(job.tags.includes('Robota.ua'))
  assert.equal(job.postedAt, NOW.toISOString())
})
