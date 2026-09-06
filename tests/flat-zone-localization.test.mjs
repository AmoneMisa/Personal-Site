import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlatLocationLabeler } from '../app/utils/flats/locationLabels.ts';

const label = createFlatLocationLabeler([{
  code: 'UZ', name: 'Backend country label', cities: ['City A', 'City B', 'City C'],
  cityLabels: { 'City A': 'Backend city label' },
  locations: {
    'City A': { districts: ['Central'], districtLabels: { Central: 'A center' }, microdistrictLabels: { 'Zone-7': 'Backend zone 7' } },
    'City B': { districts: ['Central'], districtLabels: { Central: 'B center' } },
    'City C': { districts: ['Central'] },
  },
}]);

test('flat labels use backend translations without changing canonical filter values', () => {
  assert.equal(label('UZ', 'country'), 'Backend country label');
  assert.equal(label('City A', 'city', 'UZ'), 'Backend city label');
  assert.equal(label('Zone-7', 'microdistrict', 'UZ', 'City A'), 'Backend zone 7');
  assert.equal(label('Zone-7', 'any', 'UZ', 'City A'), 'Backend zone 7');
});

test('same-name locations cannot borrow a different city or country translation', () => {
  assert.equal(label('Central', 'district', 'UZ', 'City A'), 'A center');
  assert.equal(label('Central', 'district', 'UZ', 'City B'), 'B center');
  assert.equal(label('Central', 'district', 'UZ', 'City C'), 'Central');
  assert.equal(label('Central', 'district', 'UA', 'City A'), 'Central');
  assert.equal(label('Central', 'district', 'UZ'), 'Central');
  assert.equal(label('Central', 'district'), 'Central');
});

test('missing labels stay raw; no aliases, transliteration, or suffix rules are reconstructed', () => {
  for (const value of ['Tashkent', 'Umid', 'Zzzblah-7A', 'central']) {
    assert.equal(label(value, 'any', 'UZ', 'City A'), value);
  }
  for (const value of ['', null, undefined]) assert.equal(label(value), '');
});
