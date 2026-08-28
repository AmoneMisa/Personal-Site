import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8')
const packageLock = await readFile(new URL('../package-lock.json', import.meta.url), 'utf8')
const workerDockerfile = await readFile(new URL('../jobs-worker/Dockerfile', import.meta.url), 'utf8')

test('Docker dependency installation does not require git or SSH', () => {
  const immutableGeoTarball = /https:\/\/codeload\.github\.com\/AmoneMisa\/geo-catalog\/tar\.gz\/[0-9a-f]{40}/
  assert.match(packageJson, immutableGeoTarball)
  assert.match(packageLock, immutableGeoTarball)
  assert.doesNotMatch(packageLock, /git\+ssh:|git@github\.com/)
  assert.match(workerDockerfile, /RUN npm ci --omit=dev --no-audit --no-fund/)
})
