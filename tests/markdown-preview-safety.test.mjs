import assert from 'node:assert/strict';
import test from 'node:test';

const {
  renderPlatformPreview,
  sanitizeMarkdownUrl,
} = await import('~/utils/markdownEditor/platformFormatters.ts');

test('Markdown preview only creates links for safe absolute protocols', () => {
  assert.equal(sanitizeMarkdownUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(sanitizeMarkdownUrl('mailto:test@example.com'), 'mailto:test@example.com');
  assert.equal(sanitizeMarkdownUrl('javascript:alert%281%29'), null);
  assert.equal(sanitizeMarkdownUrl('data:text/html,test'), null);
  assert.equal(sanitizeMarkdownUrl('/relative/path'), null);
});

test('unsafe Markdown URLs stay text instead of becoming executable anchors', () => {
  const unsafe = renderPlatformPreview('[run](javascript:alert%281%29)', 'telegram');
  const safe = renderPlatformPreview('[site](https://example.com)', 'telegram');

  assert.doesNotMatch(unsafe, /<a\b/i);
  assert.match(unsafe, /run \(javascript:alert%281%29\)/);
  assert.match(safe, /<a[^>]+href="https:\/\/example\.com"/i);
});
