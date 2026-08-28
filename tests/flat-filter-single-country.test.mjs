import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8');

test('flat finder keeps the country filter single-valued', () => {
  assert.match(source, /const countries = computed<string\[]>/);
  assert.match(source, /selectedCountries\.value = \[next\]/);
  assert.match(source, /params\.countries = countries\.value\[0\]/);
});

test('map zone filters are sent as structured params, not search text', () => {
  assert.match(source, /params\.microdistrict = microdistrict\.value/);
  assert.match(source, /params\.quartal = quartal\.value/);
  assert.match(source, /params\.area = mapArea\.value/);
});
