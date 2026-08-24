import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/assets/css/flat-placeholder.css', import.meta.url), 'utf8');
const shark = await readFile(new URL('../public/svg/shark.svg', import.meta.url), 'utf8');

test('Flat Finder loads the shark placeholder stylesheet', () => {
  assert.match(config, /~\/assets\/css\/flat-placeholder\.css/);
});

test('missing listing photos use the existing shark svg in card and modal', () => {
  assert.match(css, /\.flat-card__no-photo/);
  assert.match(css, /url\('\/svg\/shark\.svg'\)/);
  assert.match(css, /\.flat-modal:not\(:has\(\.flat-gallery\)\)::before/);
  assert.match(shark, /^<svg\b/);
});
