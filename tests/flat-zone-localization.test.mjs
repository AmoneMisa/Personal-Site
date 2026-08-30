import test from 'node:test';
import assert from 'node:assert/strict';

import { zoneNameLabel } from '../app/utils/locationLabels.ts';

const RU_TASHKENT_CASES = Object.freeze([
  ['Umid', 'Умид'],
  ['Kashgar', 'Кашгар'],
  ['Buyuk Turan', 'Буюк Турон'],
  ['Minor', 'Минор'],
  ['Labzak', 'Лабзак'],
  ['Rakat', 'Ракат'],
  ['Belaryk', 'Беларык'],
  ['Shahjahan', 'Шахжахон'],
  ['Mukimiy', 'Мукими'],
  ['Birlashgan', 'Бирлашган'],
  ['Nadyra', 'Нодира'],
  ['Makhmur', 'Махмур'],
  ['Olympia', 'Олимпия'],
]);

test('Tashkent map/filter zones use parsing-lexicon Russian aliases', () => {
  for (const [canonical, expected] of RU_TASHKENT_CASES) {
    assert.equal(zoneNameLabel(canonical, 'ru', 'UZ', 'Tashkent'), expected, canonical);
  }
});

test('canonical values stay unchanged for English UI', () => {
  assert.equal(zoneNameLabel('Umid', 'en', 'UZ', 'Tashkent'), 'Umid');
  assert.equal(zoneNameLabel('Kashgar', 'en', 'UZ', 'Tashkent'), 'Kashgar');
});
