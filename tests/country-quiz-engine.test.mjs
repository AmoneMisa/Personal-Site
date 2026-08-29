import test from 'node:test';
import assert from 'node:assert/strict';

const { matchCountries } = await import('~/composables/useCountryQuizEngine');
const { countryFitQuiz } = await import('~/utils/quizzes/country/countryFit');
const { countryFactsFor } = await import('~/utils/quizzes/country/countryFacts');

const BASE_USER = {
  job: { type: 'remote' },
  languages: { ru: 'fluent', en: 'fluent' },
  family: { status: 'single', kidsCount: 0 },
  // High enough that the budget pre-filter never removes a forced/selected country.
  budget: { monthlyUSD: 100000, includesRent: true },
};

function resultFor(groups, key) {
  const group = groups.find((g) => g.base.key === key);
  assert.ok(group, `expected a result for ${key}`);
  return group.base;
}

test('countryFacts.ts covers every real country and matches the disaster-risk axis direction', () => {
  const japan = countryFactsFor('countries.japan');
  const poland = countryFactsFor('countries.poland');
  assert.equal(japan.seismicRisk, 'high');
  assert.equal(japan.volcanic, true);
  assert.equal(poland.seismicRisk, 'low');
  assert.equal(poland.volcanic, false);
});

test('answering "avoid disaster risk" scores a low-risk country higher than a high-risk one', () => {
  const answers = { q22_disaster_risk: 'q22_o1' }; // "want to avoid earthquake/volcanic areas"
  const groups = matchCountries(countryFitQuiz, answers, BASE_USER, {}, 300, {
    selectedCountries: ['countries.japan', 'countries.poland'],
  });

  const japan = resultFor(groups, 'countries.japan');
  const poland = resultFor(groups, 'countries.poland');

  // With an empty indicesMap, the disaster-risk part is the only thing feeding
  // live100 for these two (everything else has no data), so this isolates it.
  assert.ok(poland.live100 > japan.live100, `expected poland (${poland.live100}) > japan (${japan.live100})`);
});

test('"doesn\'t bother me" about disaster risk does not strongly penalize a high-risk country', () => {
  const indifferent = matchCountries(countryFitQuiz, { q22_disaster_risk: 'q22_o3' }, BASE_USER, {}, 300, {
    selectedCountries: ['countries.japan'],
  });
  const avoider = matchCountries(countryFitQuiz, { q22_disaster_risk: 'q22_o1' }, BASE_USER, {}, 300, {
    selectedCountries: ['countries.japan'],
  });

  const japanIndifferent = resultFor(indifferent, 'countries.japan').live100;
  const japanAvoider = resultFor(avoider, 'countries.japan').live100;
  assert.ok(japanIndifferent > japanAvoider, `expected indifferent score (${japanIndifferent}) > avoider score (${japanAvoider})`);
});

test('a live taxBurden indicator actually moves live100 for the tax-preference axis', () => {
  const answers = { q18_taxes_vs_support: 'q18_o1' }; // strong tax_low_need preference
  const indicesMap = {
    'countries.poland': { key: 'countries.poland', updatedAtISO: '', normalized: { taxBurden: 9 }, raw: {} },
    'countries.romania': { key: 'countries.romania', updatedAtISO: '', normalized: { taxBurden: 1 }, raw: {} },
  };

  const groups = matchCountries(countryFitQuiz, answers, BASE_USER, indicesMap, 300, {
    selectedCountries: ['countries.poland', 'countries.romania'],
  });

  const lowTax = resultFor(groups, 'countries.poland').live100;
  const highTax = resultFor(groups, 'countries.romania').live100;
  assert.ok(lowTax > highTax, `expected low-tax-burden score (${lowTax}) > high-tax-burden score (${highTax})`);
});

test('a live governance indicator moves live100 for the stability/rules axes', () => {
  const answers = { q15_stability: 'q15_o1' }; // strongest stability_need option
  const groups1 = matchCountries(
    countryFitQuiz,
    answers,
    BASE_USER,
    {
      'countries.finland': { key: 'countries.finland', updatedAtISO: '', normalized: { governance: 9 }, raw: {} },
      'countries.venezuela': { key: 'countries.venezuela', updatedAtISO: '', normalized: { governance: 1 }, raw: {} },
    },
    300,
    { selectedCountries: ['countries.finland', 'countries.venezuela'] },
  );

  const stable = resultFor(groups1, 'countries.finland').live100;
  const unstable = resultFor(groups1, 'countries.venezuela').live100;
  assert.ok(stable > unstable, `expected high-governance score (${stable}) > low-governance score (${unstable})`);
});
