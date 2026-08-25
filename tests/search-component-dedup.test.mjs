import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pages = [
  'app/pages/flat-finder/index.vue',
  'app/pages/jobs/index.vue',
  'app/pages/hiring/index.vue',
];

test('all three search boards share the result grid component', () => {
  for (const path of pages) {
    const source = read(path);
    assert.match(source, /SearchResultGrid/u, path);
  }
});

test('page-specific grid wrappers stay removed', () => {
  for (const path of [
    'app/components/jobs/JobGrid.vue',
    'app/components/hiring/CandidateGrid.vue',
    'app/components/flats/FlatGrid.vue',
  ]) assert.equal(existsSync(new URL('../' + path, import.meta.url)), false, path);
});
