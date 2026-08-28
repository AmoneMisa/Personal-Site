import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatMeta.ts', import.meta.url), 'utf8');

test('flat country items use localized location labels', () => {
  assert.match(source, /options\.locationLabel\(country\.code, "country"\)/);
});
