import test from 'node:test'
import assert from 'node:assert/strict'

import { canonicalIndexablePath } from '../server/utils/canonicalPath.ts'

test('canonical spellings are left alone', () => {
  for (const path of ['/', '/about', '/en', '/en/about', '/services/merge-json']) {
    assert.equal(canonicalIndexablePath(path), null)
  }
})

test('upper case and trailing slashes redirect to the canonical path', () => {
  assert.equal(canonicalIndexablePath('/ABOUT'), '/about')
  assert.equal(canonicalIndexablePath('/about/'), '/about')
  assert.equal(canonicalIndexablePath('/en/'), '/en')
  assert.equal(canonicalIndexablePath('/EN/Services/Merge-JSON/'), '/en/services/merge-json')
})

test('unknown and dynamic paths are never rewritten', () => {
  assert.equal(canonicalIndexablePath('/services/pdf-editor/AbC123'), null)
  assert.equal(canonicalIndexablePath('/flat-finder/Some-Owner/'), null)
  assert.equal(canonicalIndexablePath('/_nuxt/Entry.JS'), null)
  assert.equal(canonicalIndexablePath('/api/Thing/'), null)
})
