import test from 'node:test';
import assert from 'node:assert/strict';
import { useClipboard } from '../app/composables/useClipboard.ts';

test('clipboard reports success only when the modern API succeeds', async (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
  });
  const writes = [];
  const clipboard = { writeText: async value => { writes.push(value); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } });
  const { copyText } = useClipboard();
  assert.equal(await copyText('share URL'), true);
  assert.deepEqual(writes, ['share URL']);
  clipboard.writeText = async () => { throw new Error('Permission denied'); };
  assert.equal(await copyText('denied'), false);
  delete globalThis.navigator.clipboard;
  assert.equal(await copyText('unavailable'), false);
  globalThis.window.isSecureContext = false;
  assert.equal(await copyText('insecure'), false);
});
