import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8')
const packageLock = await readFile(new URL('../package-lock.json', import.meta.url), 'utf8')
const workerDockerfile = await readFile(new URL('../jobs-worker/Dockerfile', import.meta.url), 'utf8')

test('Docker dependency installation does not require git or SSH', () => {
  // geo-catalog is a normal published npm package now (was a private git tarball
  // pinned by commit SHA before it had a registry release), so the invariant this
  // guards against — needing git/SSH inside the Docker build — is checked directly
  // against how npm actually resolved it, not a specific historical URL shape.
  const gitDependencyReference = /git\+ssh:|git@github\.com|github:AmoneMisa\/geo-catalog(?!\/)/
  assert.doesNotMatch(packageJson, gitDependencyReference)
  assert.doesNotMatch(packageLock, gitDependencyReference)
  assert.match(packageLock, /"resolved":\s*"https:\/\/registry\.npmjs\.org\/@whiteslove\/geo-catalog\//)
  assert.match(workerDockerfile, /RUN npm ci --omit=dev --no-audit --no-fund/)
})
