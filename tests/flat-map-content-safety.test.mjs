import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mapText, districtLabel, amenityMarker } from '../app/utils/flats/mapContent.ts';

test('map labels and marker colors cannot inject HTML or style declarations', (t) => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previousDocument; dom.window.close(); });
  const payload = '<img src=x onerror="alert(1)"><svg onload="alert(2)"></svg>';
  const color = '#fff; background-image:url(https://attacker.invalid/track)';
  const elements = [mapText(payload), districtLabel(payload, color, true), amenityMarker(payload, color)];
  for (const element of elements) {
    document.body.append(element);
    assert.equal(element.textContent, payload);
    assert.equal(element.children.length, 0);
    assert.equal(element.outerHTML.includes('https://attacker.invalid'), false);
  }
  assert.equal(document.querySelector('img,svg,[onerror],[onload]'), null);
  assert.equal(elements[1].style.borderColor, 'rgb(139, 92, 246)');
  assert.equal(elements[2].style.getPropertyValue('--amenity-color'), '#8b5cf6');
  assert.equal(districtLabel('A < B & C', '#abcdef', false).style.borderColor, 'rgb(171, 205, 239)');
});
