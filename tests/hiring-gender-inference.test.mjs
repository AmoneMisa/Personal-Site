import test from 'node:test'
import assert from 'node:assert/strict'
import { extractCandidateGender } from '../server/utils/hiringCandidateFields.ts'

test('uses explicit gender from source text first', () => {
  assert.equal(extractCandidateGender('Наиля Абдулбакиева (Женщина)'), 'female')
  assert.equal(extractCandidateGender('Пол: Мужчина'), 'male')
})

test('infers high-confidence Cyrillic surname morphology', () => {
  assert.equal(extractCandidateGender('Нуржамал Куралбаева'), 'female')
  assert.equal(extractCandidateGender('Иван Петров'), 'male')
})

test('infers Uzbek lineage markers', () => {
  assert.equal(extractCandidateGender("Sardorjon Anvarjon o'g'li"), 'male')
  assert.equal(extractCandidateGender('Dilnoza Akmal qizi'), 'female')
})

test('does not guess from an unsupported first name', () => {
  assert.equal(extractCandidateGender('Alex'), undefined)
})
