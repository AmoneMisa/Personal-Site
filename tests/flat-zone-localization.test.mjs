import test from 'node:test';
import assert from 'node:assert/strict';

import { zoneNameLabel } from '../app/utils/locationLabels.ts';

const RU_TASHKENT_CASES = Object.freeze([
  // Mahallas shown in the advanced dropdown and as map zones.
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

  // Local/informal areas visible on the map screenshot.
  ['Qorasuv', 'Карасу массив'],
  ['Ahmad Yugnakiy', 'Ахмад Югнаки массив'],
  ['Humoyun', 'Хумаюн массив'],
  ['Feruza', 'Феруза массив'],
  ['Quruvchi', 'Курувчи'],

  // Geo-catalog numbered zone canonicals shown in the dropdown.
  ['Karasu-1', 'Карасу-1'],
  ['Karasu-3', 'Карасу-3'],
  ['TTZ-1', 'ТТЗ-1'],
]);

test('Tashkent map/filter zones use parsing-lexicon Russian aliases', () => {
  for (const [canonical, expected] of RU_TASHKENT_CASES) {
    assert.equal(zoneNameLabel(canonical, 'ru', 'UZ', 'Tashkent'), expected, canonical);
  }
});

test('canonical values stay unchanged for English UI', () => {
  assert.equal(zoneNameLabel('Umid', 'en', 'UZ', 'Tashkent'), 'Umid');
  assert.equal(zoneNameLabel('Kashgar', 'en', 'UZ', 'Tashkent'), 'Kashgar');
  assert.equal(zoneNameLabel('Karasu-3', 'en', 'UZ', 'Tashkent'), 'Karasu-3');
});
