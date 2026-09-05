import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useDistrictZones.ts', import.meta.url), 'utf8');

test('district overlays prefer complete geo-catalog descendants over listing meta', () => {
  assert.match(source, /descendantsOf\("district"\)/);
  assert.match(source, /boundary: entity\.boundary/);
});
