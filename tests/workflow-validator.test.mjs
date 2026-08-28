import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const { validateWorkflow, summarizeIssues } = await import('../app/utils/workflows/validateWorkflow.ts');

const VALID = `name: CI
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
`;

const codes = (source) => validateWorkflow(source).issues.map((issue) => issue.code);

test('a well-formed workflow produces no errors', () => {
  const result = validateWorkflow(VALID);
  assert.equal(result.parsed, true);
  assert.equal(result.jobCount, 1);
  assert.equal(result.stepCount, 2);
  assert.equal(summarizeIssues(result.issues).errors, 0);
});

test('empty input is reported rather than silently passing', () => {
  assert.deepEqual(codes('   \n  '), ['empty-document']);
});

test('a YAML syntax error reports a line and column', () => {
  const result = validateWorkflow('name: CI\non:\n  push:\n   branches: [main\njobs:\n  build:\n');
  assert.equal(result.parsed, false);
  const syntax = result.issues.find((issue) => issue.code === 'yaml-syntax');
  assert.ok(syntax, 'expected a yaml-syntax issue');
  assert.equal(typeof syntax.line, 'number');
  assert.equal(typeof syntax.col, 'number');
});

test('`on` is required', () => {
  assert.ok(codes('name: X\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n').includes('missing-on'));
});

test('jobs are required and must not be empty', () => {
  assert.ok(codes('on: push\njobs: {}\n').includes('empty-jobs'));
  assert.ok(codes('on: push\n').includes('missing-jobs'));
});

test('a job needs runs-on unless it calls a reusable workflow', () => {
  assert.ok(codes('on: push\njobs:\n  a:\n    steps:\n      - run: echo\n').includes('missing-runs-on'));
  // A reusable-workflow call is legitimate without runs-on.
  const reusable = codes('on: push\njobs:\n  a:\n    uses: org/repo/.github/workflows/x.yml@abcdef0123456789abcdef0123456789abcdef01\n');
  assert.ok(!reusable.includes('missing-runs-on'));
});

test('a reusable-workflow job cannot also define steps', () => {
  const source = 'on: push\njobs:\n  a:\n    uses: org/repo/.github/workflows/x.yml@abcdef0123456789abcdef0123456789abcdef01\n    steps:\n      - run: echo\n';
  assert.ok(codes(source).includes('job-uses-with-steps'));
});

test('a step must have exactly one of uses or run', () => {
  const both = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: actions/checkout@v4\n        run: echo hi\n';
  assert.ok(codes(both).includes('step-uses-and-run'));

  const neither = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - name: nothing\n';
  assert.ok(codes(neither).includes('step-empty'));
});

test('mutable and missing action refs are flagged, SHAs are not', () => {
  const mutable = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: some/action@main\n';
  assert.ok(codes(mutable).includes('uses-mutable-ref'));

  const unversioned = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: some/action\n';
  assert.ok(codes(unversioned).includes('uses-unversioned'));

  const thirdPartyTag = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: some/action@v3\n';
  assert.ok(codes(thirdPartyTag).includes('uses-unpinned-tag'));

  const sha = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: some/action@abcdef0123456789abcdef0123456789abcdef01\n';
  assert.ok(!codes(sha).some((code) => code.startsWith('uses-')));

  // Local and container actions are not version-pinned refs at all.
  const local = 'on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: ./.github/actions/setup\n';
  assert.ok(!codes(local).some((code) => code.startsWith('uses-')));
});

test('first-party actions on a floating major tag are not flagged', () => {
  assert.ok(!codes(VALID).some((code) => code.startsWith('uses-')));
});

test('needs must reference real jobs and stay acyclic', () => {
  const unknown = 'on: push\njobs:\n  a:\n    runs-on: x\n    needs: ghost\n    steps:\n      - run: echo\n';
  assert.ok(codes(unknown).includes('needs-unknown-job'));

  const self = 'on: push\njobs:\n  a:\n    runs-on: x\n    needs: a\n    steps:\n      - run: echo\n';
  assert.ok(codes(self).includes('needs-self'));

  const cycle = [
    'on: push',
    'jobs:',
    '  a:',
    '    runs-on: x',
    '    needs: b',
    '    steps:',
    '      - run: echo',
    '  b:',
    '    runs-on: x',
    '    needs: a',
    '    steps:',
    '      - run: echo',
    '',
  ].join('\n');
  assert.ok(codes(cycle).includes('needs-cycle'));

  // A diamond is a legitimate DAG and must not be reported as a cycle.
  const diamond = [
    'on: push',
    'jobs:',
    '  root:',
    '    runs-on: x',
    '    steps: [{ run: echo }]',
    '  left:',
    '    runs-on: x',
    '    needs: root',
    '    steps: [{ run: echo }]',
    '  right:',
    '    runs-on: x',
    '    needs: root',
    '    steps: [{ run: echo }]',
    '  join:',
    '    runs-on: x',
    '    needs: [left, right]',
    '    steps: [{ run: echo }]',
    '',
  ].join('\n');
  assert.ok(!codes(diamond).includes('needs-cycle'));
});

test('hardcoded credentials are flagged but expressions are not', () => {
  const leaked = 'on: push\nenv:\n  TOKEN: ghp_abcdefghijklmnopqrstuvwxyz0123456789\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n';
  assert.ok(codes(leaked).includes('hardcoded-secret'));

  const referenced = 'on: push\nenv:\n  TOKEN: ${{ secrets.GITHUB_TOKEN }}\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n';
  assert.ok(!codes(referenced).includes('hardcoded-secret'));
});

test('missing permissions and unknown top-level keys are surfaced', () => {
  const source = 'on: push\njobz: {}\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n';
  const found = codes(source);
  assert.ok(found.includes('missing-permissions'));
  assert.ok(found.includes('unknown-top-level-key'));
});

test("this repository's own workflows parse and have no errors", async () => {
  const dir = new URL('../.github/workflows/', import.meta.url);
  const files = (await readdir(dir)).filter((name) => /\.ya?ml$/.test(name));
  assert.ok(files.length > 0, 'expected workflow files to validate against');

  for (const file of files) {
    const source = await readFile(new URL(file, dir), 'utf8');
    const result = validateWorkflow(source);
    const errors = result.issues.filter((issue) => issue.level === 'error');
    assert.deepEqual(
      errors.map((issue) => `${issue.code}: ${issue.message}`),
      [],
      `${file} should have no validation errors`,
    );
  }
});
