import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('jobs and hiring public routes delegate to isolated platform domains', async () => {
  const [jobs, hiring, meta] = await Promise.all([
    read('../server/routes/jobs-feed.get.ts'),
    read('../server/routes/hiring-feed.get.ts'),
    read('../server/routes/hiring-meta.get.ts'),
  ])
  assert.match(jobs, /requirePlatformGet\(event, 'vacancies', '\/jobs-feed'\)/)
  assert.match(hiring, /requirePlatformGet\(event, 'cv', '\/hiring-feed'\)/)
  assert.match(meta, /requirePlatformGet\(event, 'cv', '\/hiring-meta'\)/)
})

test('platform proxy preserves query parameters and fails closed without configuration', async () => {
  const proxy = await read('../server/utils/backendPlatformProxy.ts')
  assert.match(proxy, /upstream\.search = incoming\.search/)
  assert.match(proxy, /backend is not configured/)
  assert.match(proxy, /X-Backend-Platform/)
})

test('frontend alone joins the backend platform network', async () => {
  const compose = await read('../docker-compose.yml')
  assert.match(compose, /VACANCIES_API_URL:.*vacancies-api:4010/)
  assert.match(compose, /CV_API_URL:.*cv-api:4011/)
  assert.match(compose, /- backend-platform/)
  assert.match(compose, /name: whiteslove-backend-platform/)
  assert.doesNotMatch(compose, /^  jobs-worker:/m)
  assert.doesNotMatch(compose, /^  job-browser-fetcher:/m)
  assert.doesNotMatch(compose, /^  subscription-bot:/m)
})

test('site readiness checks platform APIs instead of domain databases', async () => {
  const ready = await read('../server/routes/ready.get.ts')
  assert.match(ready, /VACANCIES_API_URL/)
  assert.match(ready, /CV_API_URL/)
  assert.doesNotMatch(ready, /JOBS_DATABASE_URL|HIRING_DATABASE_URL/)
})
