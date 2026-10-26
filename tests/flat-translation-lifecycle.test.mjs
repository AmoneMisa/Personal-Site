import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { useFlatTranslation } from '~/composables/flats/useFlatTranslation.ts'
import { withVueSetup } from './helpers/vueSetup.mjs'

const listing = { id: 'translation', source: 'olx', country: 'RO', description: 'A spacious apartment with a balcony near the city center.' }

test('changing language rejects and aborts an in-flight translation', async t => {
  let finish
  let signal
  globalThis.$fetch = (_url, options) => {
    signal = options.signal
    return new Promise(resolve => { finish = resolve })
  }
  const locale = ref('ru')
  const { value: translation } = withVueSetup(t, () => useFlatTranslation(ref(listing), locale))
  const pending = translation.translateActiveDescription()
  locale.value = 'en'
  assert.equal(signal.aborted, true)
  finish({ status: 'completed', data: { translatedText: 'Старый ответ' } })
  await pending
  assert.equal(translation.translatedDescription.value, '')
  assert.equal(translation.translatingDescription.value, false)
  assert.equal(translation.translationFailed.value, false)
})

test('language changes select their own cached translation', async t => {
  globalThis.$fetch = async () => ({ status: 'completed', data: { translatedText: 'Русский перевод' } })
  const locale = ref('ru')
  const { value: translation } = withVueSetup(t, () => useFlatTranslation(ref(listing), locale))
  await translation.translateActiveDescription()
  locale.value = 'en'
  assert.equal(translation.translatedDescription.value, '')
  locale.value = 'ru'
  assert.equal(translation.translatedDescription.value, 'Русский перевод')
})

test('unmount aborts translation and ignores its eventual result', async t => {
  let finish
  globalThis.$fetch = () => new Promise(resolve => { finish = resolve })
  const { value: translation, unmount } = withVueSetup(t, () => useFlatTranslation(ref(listing), ref('ru')))
  const pending = translation.translateActiveDescription()
  unmount()
  finish({ status: 'completed', data: { translatedText: 'Too late' } })
  await pending
  assert.equal(translation.translatedDescription.value, '')
})
