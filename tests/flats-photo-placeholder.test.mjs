import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const css = await readFile(new URL('../app/assets/css/flat-placeholder.css', import.meta.url), 'utf8');
const plugin = await readFile(new URL('../app/plugins/flat-placeholder.ts', import.meta.url), 'utf8');

test('flat cards and modal use the existing shark SVG when a listing has no usable photo', async () => {
  await access(new URL('../public/svg/shark.svg', import.meta.url));
  assert.match(css, /\.flat-card__no-photo/);
  assert.match(css, /url\(['"]\/svg\/shark\.svg['"]\)/);
  assert.match(css, /\.flat-card__no-photo > \*/);
  assert.match(css, /\.flat-modal:not\(:has\(\.flat-modal__gallery\)\)::before/);
  assert.match(plugin, /~\/assets\/css\/flat-placeholder\.css/);
});
