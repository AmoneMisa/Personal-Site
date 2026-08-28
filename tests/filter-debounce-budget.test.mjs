import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const path of [
  '../app/composables/jobs/useJobFeed.ts',
  '../app/composables/hiring/useHiringFeed.ts',
  '../app/composables/flats/useFlatFeed.ts',
]) {
  test(`filter debounce is small for ${path}`, async () => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /FILTER_REQUEST_DEBOUNCE_MS = 180/);
  });
}
