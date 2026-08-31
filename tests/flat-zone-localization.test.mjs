import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { zoneNameLabel } from '../app/utils/locationLabels.ts';

const source = await readFile(new URL('../app/utils/locationLabels.ts', import.meta.url), 'utf8');

// Zone aliases, transliteration and locality suffix rules belong to the released
// parsing-lexicon API. Personal Site should only adapt its map values/context to
// that API, never recreate dictionary traversal or Uzbek/Russian suffix probes.
test('zone labels are resolved through the package-owned geography zone API', () => {
  assert.match(source, /from '@whiteslove\/parsing-lexicon\/geography-zone-display'/);
  assert.match(source, /geographyZoneDisplayName\(value, locale, \{/);
  assert.match(source, /country: countryCode/);
  assert.match(source, /city: cityName/);

  for (const localDomainRule of [
    /dictionaryFor\(/,
    /normalizedAliasKeys\(/,
    /UZBEK_CYRILLIC_SUFFIX_RE/,
    /NON_RUSSIAN_CYRILLIC_RE/,
    /dictionaryCompositeBaseLabel/,
    /massivi/,
    /даҳаси/iu,
  ]) {
    assert.doesNotMatch(source, localDomainRule);
  }
});

test('unknown zone values pass through unchanged', () => {
  const unknown = 'Zzz-Definitely-Not-A-Real-Zone';
  assert.equal(zoneNameLabel(unknown, 'ru', 'UZ', 'Tashkent'), unknown);
  assert.equal(zoneNameLabel(unknown, 'en', 'UZ', 'Tashkent'), unknown);
});

test('numbered/composite zones preserve their canonical suffix when the base is unrecognized', () => {
  assert.equal(zoneNameLabel('Zzzblah-7', 'ru', 'UZ', 'Tashkent'), 'Zzzblah-7');
  assert.equal(zoneNameLabel('Zzzblah-7A', 'en', 'UZ', 'Tashkent'), 'Zzzblah-7A');
});

test('empty/nullish values pass through as-is', () => {
  assert.equal(zoneNameLabel('', 'ru', 'UZ', 'Tashkent'), '');
  assert.equal(zoneNameLabel(null, 'ru', 'UZ', 'Tashkent'), '');
  assert.equal(zoneNameLabel(undefined, 'ru', 'UZ', 'Tashkent'), '');
});

test('a recognized mahalla is actually translated for Russian UI (without pinning the exact lexicon spelling)', () => {
  const translated = zoneNameLabel('Umid', 'ru', 'UZ', 'Tashkent');
  assert.notEqual(translated, 'Umid');
  assert.ok(translated.length > 0);
});
