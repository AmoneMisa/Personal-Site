import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

// Without the SFC <style> block, so CSS never trips the script-level checks.
const appScript = async () => (await read('app/app.vue')).replace(/<style[\s\S]*<\/style>/u, '')

test('nuxt.config does not hard-code the <html lang> attribute', async () => {
  const config = await read('nuxt.config.ts')
  assert.doesNotMatch(config, /htmlAttrs\s*:/u, 'a static app.head.htmlAttrs overrides the per-locale lang on every page')
  assert.match(config, /strategy:\s*'prefix_except_default'/u)
  assert.match(config, /code:\s*'en',\s*language:\s*'en-US'/u)
  assert.match(config, /code:\s*'ru',\s*language:\s*'ru-RU'/u)
})

test('app.vue feeds useLocaleHead output (lang + hreflang) into the head', async () => {
  const script = await appScript()
  assert.match(script, /const localeHead = useLocaleHead\(\{[^}]*lang:\s*true/u)
  assert.match(script, /seo:\s*true/u, 'seo emits hreflang alternates')
  assert.doesNotMatch(script, /\.\.\.localeHead\b/u, 'spreading the ComputedRef drops htmlAttrs/link/meta')
  const getter = script.match(/useHead\(\(\) => \(\{([\s\S]*?)\}\)\);/gu) ?? []
  const localeGetter = getter.find((block) => block.includes('localeHead.value'))
  assert.ok(localeGetter, 'locale head is read reactively via localeHead.value inside a useHead getter')
  for (const key of ['htmlAttrs', 'link', 'meta']) {
    assert.match(localeGetter, new RegExp(`${key}:\\s*localeHead\\.value\\.${key}`, 'u'), `${key} is forwarded`)
  }
})
