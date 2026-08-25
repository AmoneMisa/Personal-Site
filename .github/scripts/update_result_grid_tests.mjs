import fs from 'node:fs';

const replaceExact = (path, from, to, label) => {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Missing expected ${label}`);
  fs.writeFileSync(path, source.replace(from, to));
};

replaceExact(
  'tests/flats-layout-and-stats.test.mjs',
  "const grid = await readFile(new URL('../app/components/flats/FlatGrid.vue', import.meta.url), 'utf8')",
  "const grid = await readFile(new URL('../app/components/search/SearchResultGrid.vue', import.meta.url), 'utf8')",
  'flat grid test source',
);

replaceExact(
  'tests/jobs-statistics.test.mjs',
  "  const jobGrid = readFileSync(new URL('../app/components/jobs/JobGrid.vue', import.meta.url), 'utf8')\n",
  "  const resultGrid = readFileSync(new URL('../app/components/search/SearchResultGrid.vue', import.meta.url), 'utf8')\n",
  'job grid test source',
);
replaceExact(
  'tests/jobs-statistics.test.mjs',
  "  assert.match(jobGrid, /align-items:\\s*stretch/u)\n  assert.match(jobGrid, /job-card__salary-separator[^}]*display:\\s*none/su)\n",
  "  assert.match(resultGrid, /align-items:\\s*stretch/u)\n  assert.match(jobsPage, /jobs__grid :deep\\(\\.job-card__salary-separator\\)[^}]*display:\\s*none/su)\n",
  'job grid assertions',
);
