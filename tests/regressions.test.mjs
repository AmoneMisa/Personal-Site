import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractCandidateAge,
  extractCandidateName,
} from '../server/utils/hiringCandidateFields.ts'
import { removeExistingSocialMeta } from '../server/utils/shareHead.ts'
import { looksSoftBlocked } from '../server/utils/browserSoftBlock.ts'
import { normalizeCandidate, normalizeProfessions } from '../server/utils/hiringNormalize.ts'
import {
  activityDate,
  cityFrom,
  dayMonthDate,
  htmlText,
  parseAge,
} from '../server/utils/hiringWebFields.ts'

test('Uzbek structured CV fields keep labels out of the candidate name', () => {
  const text = [
    'Ism-familya: Mavlonova Shahlo Otanazar qizi',
    "Tug'ilgan yili: 15.10.1999",
    "Yashash manzili: Toshkent, Chilonzor tumani",
    "Ma'lumoti: Oliy",
    "So'ralgan ish joyi: Kassir",
    'Tajribasi: 2 yil',
  ].join('\n')

  assert.equal(extractCandidateName(text), 'Mavlonova Shahlo Otanazar qizi')
  assert.equal(extractCandidateAge(text, new Date('2026-08-21T12:00:00Z')), 26)
  assert.equal(extractCandidateName('familya: Mavlonova Shahlo Otanazar qizi'), 'Mavlonova Shahlo Otanazar qizi')
})

test('Uzbek and Russian cashier titles normalize to the canonical profession', () => {
  assert.deepEqual(normalizeProfessions('Кассир', ''), ['Cashier'])
  assert.deepEqual(normalizeProfessions('Kassir', ''), ['Cashier'])
  assert.deepEqual(normalizeProfessions("So'ralgan ish joyi: Kassir", ''), ['Cashier'])
})

test('successful HTTP captcha pages are treated as blocked responses', () => {
  assert.equal(looksSoftBlocked('<html><head><title>reCAPTCHA</title></head><body></body></html>'), true)
  assert.equal(looksSoftBlocked('<html><head><title>Кассир — резюме</title></head><body>Результаты поиска</body></html>'), false)
})

test('share metadata replacement preserves Nuxt assets in a combined head entry', () => {
  const head = [
    '<meta property="og:title" content="old"><link rel="stylesheet" href="/_nuxt/app.css">' +
      '<meta name="twitter:card" content="summary"><script type="module" src="/_nuxt/app.js"></script>',
  ]

  const result = removeExistingSocialMeta(head).join('')
  assert.match(result, /<link rel="stylesheet" href="\/_nuxt\/app\.css">/)
  assert.match(result, /<script type="module" src="\/_nuxt\/app\.js"><\/script>/)
  assert.doesNotMatch(result, /og:title|twitter:card/)
})

test('Cyrillic city, age and date patterns match at all', () => {
  // JavaScript's \b is ASCII-only, so every Cyrillic alternative in these
  // patterns used to match nothing: cities, ages and freshness stamps were
  // silently dropped from every board that writes in Russian or Ukrainian.
  assert.equal(cityFrom('Роман Киев (возможен переезд)', 'UA'), 'Kyiv')
  assert.equal(cityFrom('Александр Харьков', 'UA'), 'Kharkiv')
  assert.equal(cityFrom('г. Ташкент, Чиланзарский район', 'UZ'), 'Tashkent')
  assert.equal(cityFrom('Астана', 'KZ'), 'Astana')
  assert.equal(cityFrom('Bucuresti', 'RO'), 'Bucharest')
  assert.equal(cityFrom('Тбилиси', 'UA'), null)

  assert.equal(parseAge('Михаил, 34 года, Одесса'), 34)
  assert.equal(parseAge('54 лет'), 54)
  assert.equal(parseAge('32 ani, București'), 32)
  assert.equal(parseAge('дом 12, квартира 5'), null)

  assert.match(activityDate('сегодня, 14:20') ?? '', /^\d{4}-\d{2}-\d{2}T/)
  assert.match(activityDate('Вчера') ?? '', /^\d{4}-\d{2}-\d{2}T/)
  assert.match(activityDate('8 ч.') ?? '', /^\d{4}-\d{2}-\d{2}T/)
})

test('a day and month with no year resolve to the most recent past date', () => {
  const august = dayMonthDate('19 августа')
  assert.ok(august)
  assert.ok(Date.parse(august) <= Date.now() + 48 * 60 * 60 * 1000)
  assert.equal(new Date(august).getUTCMonth(), 7)
  assert.equal(new Date(august).getUTCDate(), 19)

  // A work-history duration is not a date.
  assert.equal(dayMonthDate('5 лет'), null)
})

test('relative durations in a work history are not read as an activity date', () => {
  // "опыт работы более 5 лет" and "5 месяцев" must not make a stale card look
  // fresh; only an explicit "ago" marker counts.
  assert.equal(activityDate('Высшее образование, опыт работы более 5 лет.'), null)
  assert.equal(activityDate('Менеджер, 5 месяцев'), null)
  assert.match(activityDate('5 месяцев назад') ?? '', /^\d{4}-\d{2}-\d{2}T/)
})

test('script and style contents never reach a candidate profile', () => {
  const html = [
    '<div class="card"><script>window.yaContextCb=window.yaContextCb||[];</script>',
    '<style>.card{color:red}</style>',
    '<h2>Бухгалтер</h2><span>Ташкент</span>',
    '<i class="material-icons">local_shipping</i></div>',
  ].join('')

  const text = htmlText(html)
  assert.doesNotMatch(text, /yaContextCb|color:red/)
  assert.doesNotMatch(text, /local_shipping/)
  assert.match(text, /Бухгалтер/)
  assert.match(text, /Ташкент/)
})

test('legacy Careerist rows lose icon ligatures and repeating experience fractions', () => {
  const profile = normalizeCandidate({
    id: 'careerist-1',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'careerist-uz',
    country: 'UZ',
    name: 'Юрий Садраддинович',
    role: 'Генеральный менеджер',
    city: 'Ташкент local_shipping',
    experienceYears: 20 + 4 / 12,
    url: 'https://tashkent.careerist.ru/resume/example.html',
    createdAt: '2026-08-22T12:00:00.000Z',
    originalText: 'Город\nТашкент local_shipping\nОпыт работы:\n20 лет и 4 месяца',
    description: 'Город\nТашкент local_shipping\nОпыт работы:\n20 лет и 4 месяца',
  })

  assert.equal(profile.city, 'Ташкент')
  assert.equal(profile.experienceYears, 20.3)
  assert.doesNotMatch(profile.description, /local_shipping/)
})

test('Uzbek boards that print a region instead of a city still resolve a location', () => {
  assert.equal(cityFrom('Резюме - Кашкадаря', 'UZ'), 'Kashkadarya')
  assert.equal(cityFrom('Qoraqalpog’iston', 'UZ'), 'Karakalpakstan')
  assert.equal(cityFrom('Яшнабад, Ташкент', 'UZ'), 'Tashkent')
})
