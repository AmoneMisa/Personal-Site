import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// googleOAuth.ts uses Nitro's auto-imported cookie helpers; give it a jar.
const jar = new Map()
globalThis.setCookie = (_event, name, value) => jar.set(name, value)
globalThis.getCookie = (_event, name) => jar.get(name)
globalThis.deleteCookie = (_event, name) => jar.delete(name)

const oauth = await import('../server/flats/googleOAuth.ts')
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the return path can never leave the site', () => {
  assert.equal(oauth.safeReturnPath('/flat-finder/favorites?countries=UZ'), '/flat-finder/favorites?countries=UZ')
  assert.equal(oauth.safeReturnPath('/en/flat-finder/favorites'), '/en/flat-finder/favorites')
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '', undefined, '/a b', `/${'x'.repeat(600)}`]) {
    assert.equal(oauth.safeReturnPath(bad), '/flat-finder/favorites', String(bad))
  }
  assert.equal(oauth.withAccountOutcome('/flat-finder/favorites?countries=UZ&account=old', 'linked'), '/flat-finder/favorites?countries=UZ&account=linked')
})

test('sign-in is off unless both client id and secret are set', () => {
  const saved = { ...process.env }
  try {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 's'
    assert.equal(oauth.googleOAuthConfig(), null)
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'id.apps.googleusercontent.com'
    process.env.SITE_PUBLIC_URL = 'https://whiteslove.me/'
    assert.deepEqual(oauth.googleOAuthConfig(), {
      clientId: 'id.apps.googleusercontent.com',
      clientSecret: 's',
      redirectUri: 'https://whiteslove.me/flats-account-google-callback',
    })
  } finally {
    process.env = saved
  }
})

test('the Google request asks for openid only, with PKCE, state and nonce', () => {
  jar.clear()
  const config = { clientId: 'id.apps', clientSecret: 's', redirectUri: 'https://whiteslove.me/flats-account-google-callback' }
  const url = new URL(oauth.beginGoogleSignIn({}, config, '/flat-finder/favorites'))
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  // openid alone: the token carries the subject id, not email or profile.
  assert.equal(url.searchParams.get('scope'), 'openid')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')

  const pending = oauth.takePendingSignIn({})
  assert.equal(url.searchParams.get('state'), pending.state)
  assert.equal(url.searchParams.get('nonce'), pending.nonce)
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'))
  assert.equal(pending.returnTo, '/flat-finder/favorites')
  // Consumed: a second callback with the same browser finds nothing.
  assert.equal(jar.has(oauth.OAUTH_COOKIE), false)
  assert.equal(oauth.takePendingSignIn({}), null)
})

test('the nonce is read from the ID token payload', () => {
  const payload = Buffer.from(JSON.stringify({ sub: '1', nonce: 'n-123' })).toString('base64url')
  assert.equal(oauth.idTokenNonce(`h.${payload}.s`), 'n-123')
  assert.equal(oauth.idTokenNonce('garbage'), null)
})

test('the callback checks state and nonce before linking, and always redirects', async () => {
  const route = await read('server/routes/flats-account-google-callback.get.ts')
  assert.match(route, /query\.state !== pending\.state/u)
  assert.match(route, /idTokenNonce\(idToken\) !== pending\.nonce/u)
  assert.match(route, /code_verifier: pending\.verifier/u)
  assert.match(route, /savedStateHeaders\(credentials, event\)/u)
  assert.doesNotMatch(route, /createError/u)
  // Tokens never reach the log.
  assert.doesNotMatch(route, /console\.[a-z]+\([^)]*idToken/u)
})

test('status, sign-out and delete never mint an installation', async () => {
  for (const path of ['server/routes/flats-account.get.ts', 'server/routes/flats-account-sign-out.post.ts', 'server/routes/flats-account-delete.post.ts']) {
    const route = await read(path)
    assert.match(route, /existingInstallation\(event\)/u, path)
    assert.doesNotMatch(route, /installationFor\(/u, path)
  }
})

test('signing out leaves this browser without the account\'s favourites', async () => {
  const page = await read('app/pages/flat-finder/[...slug].vue')
  assert.match(page, /<FlatAccountBar v-if="view === 'favorites'" \/>/u)
  // Sign-out may come from the header too, so the page watches the shared state.
  assert.match(page, /watch\(signedOutAt, \(\) => clearFavorites\(\)\)/u)
  const account = await read('app/composables/useSiteAccount.ts')
  assert.match(account, /signedOutAt\.value = Date\.now\(\)/u)
  // No Google script on the site: sign-in is a redirect.
  for (const path of ['app/composables/useSiteAccount.ts', 'app/components/flats/FlatAccountBar.vue', 'app/components/redesign/HeaderAccount.vue']) {
    assert.doesNotMatch(await read(path), /accounts\.google\.com|gsi\/client/u, path)
  }
  assert.match(account, /window\.location\.assign\(`\/flats-account-google-start\?return=/u)
})

test('the header offers Google sign-in on every page', async () => {
  const header = await read('app/components/redesign/HeaderNav.vue')
  assert.match(header, /<header-account \/>/u)
  assert.match(header, /<header-account mobile @done="mobileOpen = false" \/>/u)
  const button = await read('app/components/redesign/HeaderAccount.vue')
  assert.match(button, /useSiteAccount\(\)/u)
  // Hidden when the server has no Google client configured.
  assert.match(button, /v-if="loaded && enabled"/u)
  for (const locale of ['en', 'ru']) {
    const messages = JSON.parse(await read(`i18n/locales/${locale}.json`))
    for (const key of ['accountSignIn', 'accountSignOut', 'accountDelete', 'accountDeleteConfirm', 'accountLinked', 'accountFailed', 'accountPrivacy']) {
      assert.ok(messages.flats[key], `${locale}: flats.${key}`)
    }
    assert.ok(messages.account?.menu && messages.account?.signedIn, `${locale}: account.*`)
  }
})
