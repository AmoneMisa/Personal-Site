import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const stateDir = await mkdtemp(join(tmpdir(), 'personal-site-job-cursors-'))
process.env.SITE_STATE_DIR = stateDir

const { crawlCyclicJobBoard } = await import('../server/utils/cyclicJobBoardCrawler.ts')

function job(id) {
  return {
    id,
    title: `Job ${id}`,
    company: 'Example',
    location: 'Ukraine',
    country: 'UA',
    url: `https://example.com/${id}`,
    source: 'companies',
    tags: ['test'],
    postedAt: '2026-08-28T12:00:00.000Z',
  }
}

test.after(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

test('cyclic board crawler refreshes page 1 and resumes historical pages', async () => {
  const fetched = []
  const run = async () => crawlCyclicJobBoard({
    key: 'resume-test',
    pagesPerRun: 2,
    maxPage: 5,
    fetchPage: async (page) => {
      fetched.push(page)
      return String(page)
    },
    parsePage: (_html, page) => [job(`p${page}`)],
  })

  const first = await run()
  assert.deepEqual(first.pages, [1, 2, 3])
  assert.equal(first.nextPage, 4)
  assert.equal(first.cycle, 0)
  assert.equal(first.reachedEnd, false)

  fetched.length = 0
  const second = await run()
  assert.deepEqual(second.pages, [1, 4, 5])
  assert.equal(second.nextPage, 2)
  assert.equal(second.cycle, 1)
  assert.equal(second.reachedEnd, true)
  assert.deepEqual(fetched, [1, 4, 5])
})

test('empty historical page closes the cycle and restarts at page 2', async () => {
  const first = await crawlCyclicJobBoard({
    key: 'empty-test',
    pagesPerRun: 4,
    maxPage: 100,
    fetchPage: async (page) => String(page),
    parsePage: (_html, page) => page === 2 ? [] : [job(`empty-${page}`)],
  })

  assert.deepEqual(first.pages, [1, 2])
  assert.equal(first.reachedEnd, true)
  assert.equal(first.nextPage, 2)
  assert.equal(first.cycle, 1)
})

test('failed historical page is retried instead of being skipped', async () => {
  let failPageTwo = true
  const run = () => crawlCyclicJobBoard({
    key: 'retry-test',
    pagesPerRun: 2,
    maxPage: 10,
    fetchPage: async (page) => {
      if (page === 2 && failPageTwo) throw new Error('temporary failure')
      return String(page)
    },
    parsePage: (_html, page) => [job(`retry-${page}`)],
  })

  const first = await run()
  assert.deepEqual(first.pages, [1])
  assert.equal(first.nextPage, 2)

  failPageTwo = false
  const second = await run()
  assert.deepEqual(second.pages, [1, 2, 3])
  assert.equal(second.nextPage, 4)
})
