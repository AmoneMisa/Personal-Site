import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/assets/css/flat-map-mobile.css', import.meta.url), 'utf8');

test('mobile map toolbar clears Leaflet controls and can scroll horizontally', () => {
  assert.match(source, /left: 72px/);
  assert.match(source, /overflow-x: auto/);
  assert.match(source, /white-space: nowrap/);
});
