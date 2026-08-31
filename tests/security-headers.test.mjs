import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const middleware = await readFile(
  new URL('../server/middleware/security-headers.ts', import.meta.url),
  'utf8',
)

test('Nitro emits safe baseline headers without pretending CSP is complete', () => {
  assert.match(middleware, /X-Content-Type-Options', 'nosniff'/)
  assert.match(middleware, /Referrer-Policy', 'strict-origin-when-cross-origin'/)
  assert.match(middleware, /X-Frame-Options', 'DENY'/)
  assert.match(middleware, /Permissions-Policy'/)
  assert.doesNotMatch(middleware, /Content-Security-Policy'/)
  assert.doesNotMatch(middleware, /Strict-Transport-Security'/)
})
