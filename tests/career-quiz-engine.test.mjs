import test from 'node:test';
import assert from 'node:assert/strict';

const { matchProfessions } = await import('~/composables/useCareerQuizEngine');
const { professions } = await import('~/utils/quizzes/career/professions');

test('every profession has a resolvable title/description key and a non-empty vector', () => {
  for (const p of professions) {
    assert.ok(p.titleKey.startsWith('quizzes.careerFit.professions.'));
    assert.ok(p.descriptionKey.startsWith('quizzes.careerFit.professions.'));
    assert.ok(Object.keys(p.vector).length > 0, `${p.key} should have at least one axis`);
  }
});

test('with no answers, every profession still gets a neutral match score', () => {
  const results = matchProfessions({});
  assert.equal(results.length, professions.length);
  for (const r of results) {
    assert.equal(r.match100, 50);
  }
});

test('a strongly analytical/technical profile ranks Software Developer above Fitness Trainer', () => {
  const answers = {
    c1_energize: 'c1_o1', // numbers/data -> analytical
    c3_tech: 'c3_o1', // loves tech -> technical_it
    c9_logic: 'c9_o1', // logic problems -> analytical + technical_it
    c6_structure: 'c6_o3', // wants flexibility -> autonomy_flexibility
  };

  const results = matchProfessions(answers);
  const byKey = Object.fromEntries(results.map((r) => [r.profession.key, r.match100]));

  assert.ok(
    byKey['professions.developer'] > byKey['professions.fitnessTrainer'],
    `expected developer (${byKey['professions.developer']}) > fitness trainer (${byKey['professions.fitnessTrainer']})`,
  );
});

test('a strongly caring/social profile ranks Nurse above Electrician', () => {
  const answers = {
    c5_helping: 'c5_o1', // caring + social_helping
    c12_health: 'c12_o1', // caring_healthcare
    c1_energize: 'c1_o2', // people
  };

  const results = matchProfessions(answers);
  const byKey = Object.fromEntries(results.map((r) => [r.profession.key, r.match100]));

  assert.ok(
    byKey['professions.nurse'] > byKey['professions.electrician'],
    `expected nurse (${byKey['professions.nurse']}) > electrician (${byKey['professions.electrician']})`,
  );
});
