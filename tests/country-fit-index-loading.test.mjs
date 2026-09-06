import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../app/pages/quizzes/country-fit/index.vue', import.meta.url), 'utf8');

test('country-fit does not mark missing index bundles as loaded', () => {
  assert.doesNotMatch(source, /for \(const k of keys\) loaded\.add\(k\)/);
  assert.match(source, /retryAfter\.set\(k, Date\.now\(\) \+ INDEX_RETRY_DELAY_MS\)/);
});

test('country-fit tracks overlapping index requests instead of a single unsafe boolean', () => {
  assert.match(source, /const activeIndexRequests = ref\(0\)/);
  assert.match(source, /activeIndexRequests\.value \+= 1/);
  assert.match(source, /activeIndexRequests\.value = Math\.max\(0, activeIndexRequests\.value - 1\)/);
});

test('country-fit avoids deprecated escape and unescape APIs', () => {
  assert.doesNotMatch(source, /\b(?:escape|unescape)\(/);
  assert.match(source, /new TextEncoder\(\)/);
  assert.match(source, /new TextDecoder\(\)/);
});
