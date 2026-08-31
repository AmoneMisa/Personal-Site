import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const deploy = await readFile(new URL('../deploy.sh', import.meta.url), 'utf8')
const rollback = await readFile(new URL('../rollback.sh', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')
const ready = await readFile(new URL('../server/routes/ready.get.ts', import.meta.url), 'utf8')

test('all production services are deployed from one immutable commit revision', () => {
  for (const variable of [
    'FRONTEND_IMAGE_TAG',
    'BACKEND_IMAGE_TAG',
    'JOBS_WORKER_IMAGE_TAG',
    'JOB_BROWSER_FETCHER_IMAGE_TAG',
    'SUBSCRIPTION_BOT_IMAGE_TAG',
  ]) {
    assert.match(deploy, new RegExp(`export ${variable}="\\$\\{${variable}:-\\$DEPLOY_SHA\\}"`, 'u'))
    assert.match(workflow, new RegExp(`${variable}="\\$\\{\\{ github\\.sha \\}\\}"`, 'u'))
  }
})

test('successful deployments persist a rollbackable image manifest', () => {
  assert.match(deploy, /rollback\.manifest/)
  assert.match(deploy, /deployed\.manifest\.tmp/)
  assert.match(deploy, /DEPLOY_SHA=\$DEPLOY_SHA/)
  assert.match(rollback, /source "\$MANIFEST"/)
  assert.match(rollback, /git reset --hard "\$DEPLOY_SHA"/)
  assert.match(rollback, /FORCE_DEPLOY=1 DEPLOY_SOURCE=rollback/)
})

test('deployment gates success on dependency-aware readiness', () => {
  assert.match(deploy, /http:\/\/127\.0\.0\.1:8080\/ready/)
  assert.match(compose, /fetch\('http:\/\/localhost:3000\/ready'\)/)
  assert.match(ready, /await checkStateDirectory\(\)/)
  assert.match(ready, /await checkDatabase\(url\)/)
  assert.match(ready, /setResponseStatus\(event, 503\)/)
})

test('jobs worker lease heartbeat is configurable in production', () => {
  assert.match(compose, /JOBS_QUEUE_HEARTBEAT_SECONDS: \$\{JOBS_QUEUE_HEARTBEAT_SECONDS:-60\}/)
})
