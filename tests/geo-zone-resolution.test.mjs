import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8');

test('map zones resolve through the canonical city entity', () => {
  assert.match(source, /resolveLexiconGeoEntity/);
  assert.match(source, /entity\.parentId === cityEntity\.id/);
});
