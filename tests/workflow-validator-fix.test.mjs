import test from 'node:test';
import assert from 'node:assert/strict';

const { fixWorkflow } = await import('../app/utils/workflows/fixWorkflow.ts');
const { validateWorkflow } = await import('../app/utils/workflows/validateWorkflow.ts');

test('a syntactically broken document is left untouched', () => {
  const source = 'name: CI\non:\n  push:\n   branches: [main\njobs:\n  build:\n';
  const result = fixWorkflow(source);
  assert.equal(result.changed, false);
  assert.equal(result.fixed, source);
  assert.deepEqual(result.applied, []);
});

test('requotes `on` when it was coerced to a boolean key', () => {
  const source = 'name: CI\ntrue:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
  const result = fixWorkflow(source);
  assert.ok(result.applied.includes('on-parsed-as-boolean'));
  assert.match(result.fixed, /^on:/m);
  assert.doesNotMatch(result.fixed, /^true:/m);
  // The fix must actually resolve the issue on re-validation.
  assert.ok(!validateWorkflow(result.fixed).issues.some((issue) => issue.code === 'on-parsed-as-boolean'));
});

test('inserts a name when missing, without disturbing other keys', () => {
  const source = 'on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
  const result = fixWorkflow(source);
  assert.ok(result.applied.includes('missing-name'));
  assert.match(result.fixed, /^name: CI\non: push/);
  assert.ok(!validateWorkflow(result.fixed).issues.some((issue) => issue.code === 'missing-name'));
});

test('does not add a second name when one already exists', () => {
  const source = 'name: My Workflow\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
  const result = fixWorkflow(source);
  assert.ok(!result.applied.includes('missing-name'));
  assert.match(result.fixed, /^name: My Workflow$/m);
});

test('replaces a hardcoded token with a secrets reference, derived from the env key', () => {
  const source = 'on: push\nenv:\n  MY_TOKEN: ghp_abcdefghijklmnopqrstuvwxyz0123456789\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
  const result = fixWorkflow(source);
  assert.ok(result.applied.includes('hardcoded-secret'));
  assert.match(result.fixed, /MY_TOKEN: \$\{\{ secrets\.MY_TOKEN \}\}/);
  assert.ok(!validateWorkflow(result.fixed).issues.some((issue) => issue.code === 'hardcoded-secret'));
});

test('fixes a leaked secret nested under a job/step env, not just the root', () => {
  const source = 'on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n        env:\n          API_KEY: AKIAABCDEFGHIJKLMNOP\n';
  const result = fixWorkflow(source);
  assert.ok(result.applied.includes('hardcoded-secret'));
  assert.match(result.fixed, /API_KEY: \$\{\{ secrets\.API_KEY \}\}/);
});

test('an expression-based env value is left alone', () => {
  const source = 'on: push\nenv:\n  TOKEN: ${{ secrets.GITHUB_TOKEN }}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
  const result = fixWorkflow(source);
  assert.ok(!result.applied.includes('hardcoded-secret'));
});

test('re-serializing always normalizes indentation and trailing whitespace', () => {
  const source = 'name: CI   \non: push\njobs:\n    build:\n        runs-on: ubuntu-latest   \n        steps:\n          - run: echo hi\n\n\n';
  const result = fixWorkflow(source);
  assert.equal(result.changed, true);
  assert.ok(result.applied.includes('formatting'));
  assert.doesNotMatch(result.fixed, / +\n/); // no trailing whitespace on any line
  assert.match(result.fixed, /\n {2}build:\n {4}runs-on: ubuntu-latest\n {4}steps:\n {6}- run: echo hi\n$/);
});

test('an already-clean workflow reports nothing applied and no change', () => {
  const source = 'name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';
  const result = fixWorkflow(source);
  assert.equal(result.changed, false);
  assert.deepEqual(result.applied, []);
  assert.equal(result.fixed, source);
});

test('fixing this repository\'s own workflows changes no semantics, and preserves wrapped scalars', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = new URL('../.github/workflows/', import.meta.url);
  for (const file of (await readdir(dir)).filter((name) => /\.ya?ml$/.test(name))) {
    const source = await readFile(new URL(file, dir), 'utf8');
    const result = fixWorkflow(source);
    // None of these have a real structural issue — at most a CRLF/whitespace
    // normalization ("formatting"), never one of the semantic fix codes.
    for (const code of result.applied) {
      assert.notEqual(code, 'on-parsed-as-boolean', `${file} should not need on-parsed-as-boolean`);
      assert.notEqual(code, 'missing-name', `${file} should not need missing-name`);
      assert.notEqual(code, 'hardcoded-secret', `${file} should not need hardcoded-secret`);
    }
    // Re-serializing must not un-wrap a folded/multi-line scalar onto one line.
    if (source.includes('>-')) assert.ok(result.fixed.includes('>-'), `${file} should keep its folded scalars`);
  }
});
