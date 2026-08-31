import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const clientIp = await readFile(new URL('../server/utils/requestClientIp.ts', import.meta.url), 'utf8')
const translationRoute = await readFile(new URL('../server/routes/flats-translate.post.ts', import.meta.url), 'utf8')

test('forwarded client IP headers are opt-in rather than trusted unconditionally', () => {
  assert.match(clientIp, /TRUST_PROXY_IP_HEADERS/)
  assert.match(clientIp, /xForwardedFor:\s*trustedProxyIpHeadersEnabled\(\)/)
  assert.doesNotMatch(clientIp, /xForwardedFor:\s*true/)
  assert.doesNotMatch(translationRoute, /xForwardedFor:\s*true/)
  assert.match(translationRoute, /requestClientIp\(event\)/)
})
