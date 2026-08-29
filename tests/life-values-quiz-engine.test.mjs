import test from 'node:test';
import assert from 'node:assert/strict';

const { scoreLifeValues } = await import('~/composables/useLifeValuesQuizEngine');
const { LIFE_VALUES } = await import('~/utils/quizzes/values/lifeValues');

test('with no answers, every value scores zero and ties at 0%', () => {
  const results = scoreLifeValues({});
  assert.equal(results.length, LIFE_VALUES.length);
  for (const r of results) {
    assert.equal(r.score, 0);
    assert.equal(r.percent, 0);
  }
});

test('answering only security-leaning options ranks security_stability first', () => {
  const answers = {
    v1_bigDecision: 'v1_o1',
    v2_routine: 'v2_o1',
    v12_risk: 'v12_o3',
  };

  const results = scoreLifeValues(answers);
  assert.equal(results[0].key, 'security_stability');
  assert.equal(results[0].percent, 100);
});

test('answering only adventure/freedom-leaning options ranks adventure_novelty or freedom_autonomy first', () => {
  const answers = {
    v2_routine: 'v2_o3', // adventure_novelty +3
    v11_freeWeekend: 'v11_o1', // adventure_novelty +3
    v4_control: 'v4_o1', // freedom_autonomy +3
  };

  const results = scoreLifeValues(answers);
  assert.ok(['adventure_novelty', 'freedom_autonomy'].includes(results[0].key));
  assert.equal(results[0].percent, 100);
});

test('results are sorted descending by score', () => {
  const answers = {
    v5_money: 'v5_o1',
    v6_creativity: 'v6_o1',
    v9_drive: 'v9_o2',
  };

  const results = scoreLifeValues(answers);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});
