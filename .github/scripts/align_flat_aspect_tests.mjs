import fs from 'node:fs';

const files = [
  'tests/flats-layout-and-stats.test.mjs',
  'tests/flats-visual-continuity.test.mjs',
  'tests/regressions.test.mjs',
];

for (const path of files) {
  const source = fs.readFileSync(path, 'utf8');
  const updated = source.replaceAll('aspect-ratio: 2 \\/ 1', 'aspect-ratio: 16 \\/ 9');
  if (updated === source) throw new Error(`No stale 2/1 aspect-ratio assertion found in ${path}`);
  fs.writeFileSync(path, updated);
}
