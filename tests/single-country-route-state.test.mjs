import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatRouteState.ts', import.meta.url), 'utf8');

test('flat route serializes one country', () => {
  assert.match(source, /q\.countries = countries\.value\[0\]/);
});
