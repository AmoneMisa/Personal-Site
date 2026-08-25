import assert from 'node:assert/strict'
import test from 'node:test'

import { extractCandidateGender } from '../server/utils/hiringCandidateFields.ts'
import { trimCareeristProfileText } from '../server/utils/hiringCareeristFields.ts'
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
  assert.equal(publicCandidateName('Не указано', 'ru'), 'ФИО скрыто')
  assert.equal(publicCandidateName('ABDURAHMON SOBIROV', 'ru'), 'Abdurahmon Sobirov')
})

test('candidate gender prefers explicit source markers and strong grammatical name morphology', () => {
  assert.equal(extractCandidateGender('Нуржамал Куралбаева'), 'female')
  assert.equal(extractCandidateGender("Sardorjon Anvarjon o'g'li"), 'male')
  assert.equal(extractCandidateGender('Саид Тохир угли'), 'male')
  assert.equal(extractCandidateGender('Шахризода Нурали кизи'), 'female')
  assert.equal(extractCandidateGender('Zilola (Мужчина)'), 'male')
  assert.equal(extractCandidateGender('Umarova Mahliyo (девушка)'), 'female')
  assert.equal(extractCandidateGender('ABDURAHMON SOBIROV'), 'male')
  assert.equal(extractCandidateGender('Любая работа\nИщу работу удаленно'), undefined)
})

test('generic online and flexible titles become Any Role without leaking previous work', () => {
  const item = profile({
    role: 'Онлайн',
    professions: ['Kindergarten Teacher'],
    previousProfessions: ['Kindergarten Teacher'],
    originalText: 'Онлайн\nРанее работала воспитателем',
  })
  assert.deepEqual(publicCandidateProfessionKeys(item), ['Any Role'])
  assert.equal(publicCandidateRemote(item), true)
  assert.equal(hiringProfessionLabel('Any Role', 'ru'), 'Любая работа')

  for (const role of ['Boshqa ishlar', 'Farqi yuq', 'Tungi', 'Bilmayma', 'onlayn ish']) {
    assert.deepEqual(publicCandidateProfessionKeys(profile({ role })), ['Any Role'])
  }
})

test('generic cafe and restaurant search gets a neutral HoReCa role', () => {
  const item = profile({ role: 'Ищу работу в кафе или ресторанах' })
  assert.deepEqual(publicCandidateProfessionKeys(item), ['Restaurant / Cafe Worker'])
  assert.equal(hiringProfessionLabel('Restaurant / Cafe Worker', 'ru'), 'Работник кафе / ресторана')
})

test('common Uzbek board titles normalize to useful canonical professions', () => {
  const cases = [
    ['Xaydovchilik', ['Driver']],
    ["Do'kon", ['Retail Worker']],
    ['Logistika updater', ['Logistics Specialist']],
    ['Dorishunos', ['Pharmacist']],
    ['Huquqshunos, pedagog', ['Lawyer', 'Teacher']],
    ['Sugurta', ['Insurance Specialist']],
    ['Svarchik', ['Welder']],
    ['Zavod ishlari qandolat', ['Confectioner']],
    ['Kanditsaner', ['HVAC Technician']],
    ['Natarus yordamchisi Toshkent shahardan', ['Notary Assistant']],
    ["Mobilografiya bo'yicha", ['Mobile Content Creator']],
    ['Ichki nazoratchi', ['Internal Control Specialist']],
    ['Бренд фейс', ['Brand Ambassador']],
    ['KUTUBXONACHI', ['Librarian']],
    ['Vokal: xonanda', ['Singer / Vocalist']],
    ['Model', ['Model']],
    ['Бортпроводник', ['Flight Attendant']],
    ['Mehmonxona va turfirma boyicha ish kerak', ['Tourism / Hospitality Specialist']],
    ['Bosh buxgalter', ['Chief Accountant']],
  ]
  for (const [role, expected] of cases) {
    assert.deepEqual(publicCandidateProfessionKeys(profile({ role })), expected, role)
  }
})

test('generic finance and water-supply titles become useful canonical roles', () => {
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: 'Финансы, Банки' })), ['Finance / Banking Specialist'])
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: "Suv ta’minoti" })), ['Water Supply Specialist'])
})

test('operative is normalized as operative officer, not operator', () => {
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: 'Оперативник' })), ['Operative Officer'])
  assert.equal(hiringProfessionLabel('Operative Officer', 'ru'), 'Оперуполномоченный')
})

test('specific Careerist management and banking titles are not collapsed to generic manager/operator', () => {
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: 'Коммерческий директор (CCO/Chief Commercial Officer)' })), ['Commercial Director'])
  assert.deepEqual(publicCandidateProfessionKeys(profile({ role: 'Стажер операционист' })), ['Bank Operations Specialist'])
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

test('Careerist UZ million-scale local salaries mislabeled as RUB are repaired to UZS', () => {
  const local = publicCandidateSalary(profile({
    sourceKey: 'careerist-uz',
    currency: 'RUB',
    salaryMin: 4_000_000,
    salaryMax: 4_000_000,
    originalText: 'Стажер операционист\n4 000 000 руб',
  }))
  assert.equal(local.currency, 'UZS')
  assert.equal(local.salaryMin, 4_000_000)

  const realRub = publicCandidateSalary(profile({
    sourceKey: 'careerist-uz',
    currency: 'RUB',
    salaryMin: 42_000,
    salaryMax: 42_000,
    originalText: 'Специалист по исламскому банкингу\n42 000 руб',
  }))
  assert.equal(realRub.currency, 'RUB')
})

test('Careerist profile text stops before an appended neighbouring resume', () => {
  const text = [
    '1 августа, 2026',
    'Специалист по исламскому банкингу',
    'Jahongir',
    'Город',
    'Ташкент',
    'Возраст',
    '56 лет (22 августа 1970)',
    'Опыт работы:',
    '1 год и 4 месяца',
    'Оператор чата',
    '42 000 руб',
    'Самир Бахтиерович',
    'Город',
    'Самарканд',
    'Возраст',
    '19 лет',
  ].join('\n')
  const trimmed = trimCareeristProfileText(text)
  assert.match(trimmed, /Jahongir/u)
  assert.doesNotMatch(trimmed, /Самир Бахтиерович/u)
  assert.doesNotMatch(trimmed, /Оператор чата/u)
})

test('languages and proficiency are recovered from free-form CV text without cross-language leakage', () => {
  const languages = publicCandidateLanguages(profile({
    originalText: 'Знание профессионального русского языка и базового таджикского языка. English level: B2.',
  }), 'ru')
  assert.ok(languages.includes('Русский — профессиональный'))
  assert.ok(languages.includes('Таджикский — базовый'))
  assert.ok(languages.includes('Английский — B2'))
  assert.ok(!languages.includes('Таджикский — B2'))
})
