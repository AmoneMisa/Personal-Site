import assert from 'node:assert/strict'
import test from 'node:test'

import { extractCandidateGender } from '../server/utils/hiringCandidateFields.ts'
import {
  publicCandidateLanguages,
  publicCandidateName,
  publicCandidateProfessionKeys,
  publicCandidateRemote,
  publicCandidateSalary,
} from '../server/utils/hiringCandidatePresentation.ts'
import { hiringProfessionLabel } from '../shared/hiringProfessionLabels.ts'

function profile(overrides = {}) {
  return {
    id: 'candidate-test',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'test',
    country: 'UZ',
    name: '',
    role: '',
    url: 'https://example.test/cv/1',
    createdAt: '2026-08-23T00:00:00.000Z',
    originalText: '',
    description: '',
    ...overrides,
  }
}

test('hidden candidate names are presented consistently and all-caps names are normalized', () => {
  assert.equal(publicCandidateName('', 'ru'), 'ФИО скрыто')
  assert.equal(publicCandidateName('????????', 'ru'), 'ФИО скрыто')
  assert.equal(publicCandidateName('ФИО скрыто', 'ru'), 'ФИО скрыто')
  assert.equal(publicCandidateName('ABDURAHMON SOBIROV', 'ru'), 'Abdurahmon Sobirov')
})

test('candidate gender prefers explicit source markers and supports strong name morphology', () => {
  assert.equal(extractCandidateGender('Нуржамал Куралбаева'), 'female')
  assert.equal(extractCandidateGender("Sardorjon Anvarjon o'g'li"), 'male')
  assert.equal(extractCandidateGender('Zilola (Мужчина)'), 'male')
  assert.equal(extractCandidateGender('Umarova Mahliyo (девушка)'), 'female')
  assert.equal(extractCandidateGender('ABDURAHMON SOBIROV'), 'male')
})

test('generic online titles do not replace the current desired role with previous experience', () => {
  const item = profile({
    role: 'Онлайн',
    professions: ['Kindergarten Teacher'],
    previousProfessions: ['Kindergarten Teacher'],
    originalText: 'Онлайн\nРанее работала воспитателем',
  })
  assert.deepEqual(publicCandidateProfessionKeys(item), ['Any Role'])
  assert.equal(publicCandidateRemote(item), true)
  assert.equal(hiringProfessionLabel('Any Role', 'ru'), 'Любая работа')
})

test('generic cafe and restaurant search gets a neutral HoReCa role', () => {
  const item = profile({ role: 'Ищу работу в кафе или ресторанах' })
  assert.deepEqual(publicCandidateProfessionKeys(item), ['Restaurant / Cafe Worker'])
  assert.equal(hiringProfessionLabel('Restaurant / Cafe Worker', 'ru'), 'Работник кафе / ресторана')
})

test('generic finance and water-supply titles become useful canonical roles', () => {
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: 'Финансы, Банки' })), ['Finance / Banking Specialist'])
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: "Suv ta’minoti" })), ['Water Supply Specialist'])
})

test('operative is normalized as operative officer, not operator', () => {
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: 'Оперативник' })), ['Operative Officer'])
  assert.equal(hiringProfessionLabel('Operative Officer', 'ru'), 'Оперуполномоченный')
})

test('mixed salary units are parsed per bound', () => {
  const salary = publicCandidateSalary(profile({
    currency: 'UZS',
    salaryMin: 1_000_000,
    salaryMax: 500_000_000,
    originalText: 'Желаемая зарплата: от 500 тысяч до 1 миллиона сум',
  }))
  assert.equal(salary.salaryMin, 500_000)
  assert.equal(salary.salaryMax, 1_000_000)
  assert.equal(salary.currency, 'UZS')
})

test('languages and proficiency are recovered from free-form CV text', () => {
  const languages = publicCandidateLanguages(profile({
    originalText: 'Знание профессионального русского языка и базового таджикского языка.',
  }), 'ru')
  assert.ok(languages.includes('Русский — профессиональный'))
  assert.ok(languages.includes('Таджикский — базовый'))
})
