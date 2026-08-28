import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatRouteState.ts', import.meta.url), 'utf8');

test('structured map zones persist in the URL', () => {
  assert.match(source, /q\.microdistrict = microdistrict\.value/);
  assert.match(source, /q\.quartal = quartal\.value/);
  assert.match(source, /q\.area = mapArea\.value/);
});
