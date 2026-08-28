import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const [name, path] of [
  ['jobs', '../app/composables/jobs/useJobFeed.ts'],
  ['hiring', '../app/composables/hiring/useHiringFeed.ts'],
  ['flats', '../app/composables/flats/useFlatFeed.ts'],
]) {
  test(`${name} feed debounces filter requests`, async () => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /FILTER_REQUEST_DEBOUNCE_MS = 180/);
    assert.match(source, /debounceFilterRequest\(\)/);
    assert.match(source, /!append && !background/);
  });
}
