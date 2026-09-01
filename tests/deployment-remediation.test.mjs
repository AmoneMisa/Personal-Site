import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const deploy = await readFile(new URL('../deploy.sh', import.meta.url), 'utf8')
const rollback = await readFile(new URL('../rollback.sh', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')
const ready = await readFile(new URL('../server/routes/ready.get.ts', import.meta.url), 'utf8')

test('Personal Site production owns exactly frontend and helper backend images', () => {
  for (const variable of ['FRONTEND_IMAGE_TAG', 'BACKEND_IMAGE_TAG']) {
    assert.match(deploy, new RegExp(`export ${variable}="\\$\\{${variable}:-\\$DEPLOY_SHA\\}"`, 'u'))
    assert.match(workflow, new RegExp(`${variable}="\\$\\{\\{ github\\.sha \\}\\}"`, 'u'))
  }

  const legacy = /JOBS_WORKER_IMAGE_TAG|JOB_BROWSER_FETCHER_IMAGE_TAG|SUBSCRIPTION_BOT_IMAGE_TAG|personal-site-jobs-worker|personal-site-job-browser-fetcher|personal-site-subscription-bot/u
  assert.doesNotMatch(deploy, legacy)
  assert.doesNotMatch(rollback, legacy)
  assert.doesNotMatch(workflow, legacy)
})

test('successful deployments persist a rollbackable two-image manifest', () => {
  assert.match(deploy, /rollback\.manifest/)
  assert.match(deploy, /DEPLOY_SHA=\$DEPLOY_SHA/)
  assert.match(deploy, /FRONTEND_IMAGE_TAG=\$FRONTEND_IMAGE_TAG/)
  assert.match(deploy, /BACKEND_IMAGE_TAG=\$BACKEND_IMAGE_TAG/)
  assert.match(rollback, /source "\$MANIFEST"/)
  assert.match(rollback, /git reset --hard "\$DEPLOY_SHA"/)
})

test('site deploy requires backend-platform network and never runs workforce migrations', () => {
  assert.match(deploy, /docker network inspect whiteslove-backend-platform/)
  assert.doesNotMatch(deploy, /migrate-database|prepare-database-schema|jobs-worker|job-browser-fetcher|subscription-bot/)
  assert.doesNotMatch(workflow, /jobs-worker|job-browser-fetcher|subscription-bot/)
})

test('readiness is state plus vacancies/cv platform APIs', () => {
  assert.match(deploy, /http:\/\/127\.0\.0\.1:8080\/\$\{path\}/)
  assert.match(compose, /fetch\('http:\/\/localhost:3000\/ready'\)/)
  assert.match(ready, /await Promise\.all/)
  assert.match(ready, /VACANCIES_API_URL/)
  assert.match(ready, /CV_API_URL/)
})
