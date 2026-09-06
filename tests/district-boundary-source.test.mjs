import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useDistrictZones.ts', import.meta.url), 'utf8');

test('district overlays consume backend-provided canonical boundaries', () => {
  assert.match(source, /useGeoCityCatalog/);
  assert.match(source, /boundary: entity\.boundary/);
  assert.doesNotMatch(source, /@whiteslove\/(?:geo-catalog|parsing-lexicon)/);
});
