import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { zoneNameLabel } from '../app/utils/locationLabels.ts';

const source = await readFile(new URL('../app/utils/locationLabels.ts', import.meta.url), 'utf8');

// Real zone/mahalla canonical names and their translations live in
// parsing-lexicon's geo dictionaries (and drift there, e.g. Karasu -> Qorasuv
// transliteration renames). Personal Site must resolve labels through the
// package's own lookups, not a second hardcoded translation table that would
// silently fall out of sync. See AGENTS.md #39 and #77.
test('zone labels are resolved through parsing-lexicon, not a local translation table', () => {
  assert.match(source, /from '@whiteslove\/parsing-lexicon'/);
  assert.match(source, /dictionaryFor\(/);
  assert.match(source, /findCanonical\(/);
  assert.match(source, /geographyDisplayName\(/);
});

test('unknown zone values pass through unchanged', () => {
  const unknown = 'Zzz-Definitely-Not-A-Real-Zone';
  assert.equal(zoneNameLabel(unknown, 'ru', 'UZ', 'Tashkent'), unknown);
  assert.equal(zoneNameLabel(unknown, 'en', 'UZ', 'Tashkent'), unknown);
});

test('numbered/composite zones preserve their canonical suffix when the base is unrecognized', () => {
  assert.equal(zoneNameLabel('Zzzblah-7', 'ru', 'UZ', 'Tashkent'), 'Zzzblah-7');
  assert.equal(zoneNameLabel('Zzzblah-7A', 'en', 'UZ', 'Tashkent'), 'Zzzblah-7A');
});

test('empty/nullish values pass through as-is', () => {
  assert.equal(zoneNameLabel('', 'ru', 'UZ', 'Tashkent'), '');
  assert.equal(zoneNameLabel(null, 'ru', 'UZ', 'Tashkent'), '');
  assert.equal(zoneNameLabel(undefined, 'ru', 'UZ', 'Tashkent'), '');
});

test('a recognized mahalla is actually translated for Russian UI (without pinning the exact lexicon spelling)', () => {
  const translated = zoneNameLabel('Umid', 'ru', 'UZ', 'Tashkent');
  assert.notEqual(translated, 'Umid');
  assert.ok(translated.length > 0);
});
