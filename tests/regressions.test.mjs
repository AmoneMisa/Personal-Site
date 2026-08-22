import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractCandidateAge,
  extractCandidateName,
} from '../server/utils/hiringCandidateFields.ts'
import { removeExistingSocialMeta } from '../server/utils/shareHead.ts'
import { looksSoftBlocked } from '../server/utils/browserSoftBlock.ts'
import { dedupeCandidates, normalizeCandidate, normalizeProfessions } from '../server/utils/hiringNormalize.ts'
import { repairCandidateProfile } from '../server/utils/hiringQuality.ts'
import { withProfessionExperience } from '../server/utils/hiringExperience.ts'
import { trimCareeristProfileText } from '../server/utils/hiringCareeristFields.ts'
import {
  ishBorLocationFromText,
  ishBorProfileHtml,
  trimIshBorProfileText,
} from '../server/utils/hiringIshBorFields.ts'
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
  assert.equal(cityFrom('Ташкент обл.', 'UZ'), 'Tashkent Region')
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

test('specific sales and Uzbek CE driver titles normalize to canonical roles', () => {
  assert.deepEqual(normalizeProfessions('Менеджер экспортных продаж РФ', ''), ['Sales Manager'])
  assert.deepEqual(normalizeProfessions('СЕ КАТЕГОРИЯ БУЙИЧА', ''), ['Driver'])
  assert.deepEqual(normalizeProfessions('Bugalteriya bo`yicha ish kerak', ''), ['Accountant'])
  assert.deepEqual(normalizeProfessions('Kassa xodimi', ''), ['Cashier'])
  assert.deepEqual(normalizeProfessions('Notarius', ''), ['Notary'])
  assert.deepEqual(normalizeProfessions("Metrologiya, audit, standartlashtirish sohasi bo'yicha", ''), ['Metrology Specialist'])
})

test('Careerist trusts its listing headline and drops impossible age zero', () => {
  const normalized = normalizeCandidate({
    id: 'careerist-erlan', source: 'telegram', origin: 'web', sourceKey: 'careerist-uz', country: 'UZ',
    name: 'Эрлан', role: 'Cybersecurity Specialist, Водитель', professions: ['Cybersecurity Specialist', 'Driver'], age: 0,
    url: 'https://tashkent.careerist.ru/resume/erlan-6854116.html', createdAt: '2026-08-07T12:00:00.000Z',
    originalText: '7 августа, 2026\nРуководитель по информационной безопасности (CISO)\nЭрлан\nГород\nТашкент\nВозраст\n0',
    description: '7 августа, 2026\nРуководитель по информационной безопасности (CISO)\nЭрлан\nГород\nТашкент\nВозраст\n0',
  })
  assert.deepEqual(normalized.professions, ['Cybersecurity Specialist'])
  assert.equal(normalized.age, null)
})

test('Telegram technology cards recover candidate role and structured names', () => {
  assert.equal(extractCandidateName("F.I.SH: Rajabboyev Rajabboy Bahodir o‘g‘li\nTug'ilgan yili: 1999-yil"), 'Rajabboyev Rajabboy Bahodir o‘g‘li')
  assert.equal(extractCandidateAge('YOSHIM 26 DA OILALIMAN', new Date('2026-08-22T12:00:00Z')), 26)
  const flutter = repairCandidateProfile(normalizeCandidate({
    id: 'tg-flutter', source: 'telegram', country: 'UZ', name: 'Sarvar', role: '',
    url: 'https://t.me/example/1', createdAt: '2026-08-20T12:00:00.000Z',
    originalText: 'Xodim: Sarvar\nTexnologiya: Flutter, Dart\nHudud: Toshkent sh',
    description: 'Xodim: Sarvar\nTexnologiya: Flutter, Dart\nHudud: Toshkent sh',
  }))
  assert.deepEqual(flutter.professions, ['Mobile Developer'])
})

test('Flagma rejects presentation fields as role, education and contact', () => {
  const normalized = normalizeCandidate({
    id: 'flagma-invalid', source: 'telegram', origin: 'web', sourceKey: 'flagma-uz', country: 'UZ',
    name: 'ФИО скрыто', role: 'УДАЛЕННО', professions: ['УДАЛЕННО'], education: 'удаленно', contact: '9 990 000',
    contactType: 'platform', url: 'https://flagma.uz/ru/resume-example.html', createdAt: '2026-08-20T12:00:00.000Z',
    originalText: 'УДАЛЕННО\n9 990 000 сум\nФИО скрыто, 39 лет, Ташкент | Среднее-специальное\nнеполная занятость, удаленно',
    description: 'УДАЛЕННО\n9 990 000 сум\nФИО скрыто, 39 лет, Ташкент | Среднее-специальное\nнеполная занятость, удаленно',
  })
  assert.equal(normalized.name, '')
  assert.equal(normalized.role, '')
  assert.equal(normalized.education, 'Среднее-специальное')
  assert.equal(normalized.contact, normalized.url)
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

test('Careerist drops listing scripts and derives currency from the salary line', () => {
  const text = [
    '20 августа, 2026',
    'Начальник ПТО, инженер ПТО в строительстве',
    '150 000 руб',
    'Хабиб Азизович',
    'Город',
    'Ташкент local_shipping',
    'Показать еще',
    '1',
    '<!--',
    '$(document).ready(function(){ window.open(link); });',
  ].join('\n')
  const normalized = normalizeCandidate({
    id: 'careerist-khabib',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'careerist-uz',
    country: 'UZ',
    name: 'Хабиб Азизович',
    role: 'Начальник ПТО, инженер ПТО в строительстве',
    city: 'Ташкент local_shipping',
    salaryMin: 150000,
    salaryMax: 150000,
    currency: 'USD',
    skills: ['JavaScript'],
    url: 'https://tashkent.careerist.ru/resume/example.html',
    createdAt: '2026-08-20T12:00:00.000Z',
    originalText: text,
    description: text,
  })

  assert.equal(normalized.currency, 'RUB')
  assert.deepEqual(normalized.skills, [])
  assert.doesNotMatch(normalized.description, /Показать еще|document\.ready|window\.open/)
  assert.doesNotMatch(trimCareeristProfileText(text), /Показать еще|document\.ready/)
})

test('mixed Latin initial in a Cyrillic candidate name is repaired', () => {
  const normalized = normalizeCandidate({
    id: 'ishbor-alisher', source: 'telegram', origin: 'web', sourceKey: 'ishbor-uz', country: 'UZ',
    name: 'Aлишер', role: 'СЕ КАТЕГОРИЯ БУЙИЧА', url: 'https://ish-bor.uz/ru/ishchilar/id/118036',
    createdAt: '2026-08-20T12:00:00.000Z', originalText: 'СЕ КАТЕГОРИЯ БУЙИЧА\nДжизак\nAлишер',
    description: 'СЕ КАТЕГОРИЯ БУЙИЧА\nДжизак\nAлишер',
  })
  assert.equal(normalized.name, 'Алишер')
  assert.deepEqual(normalized.professions, ['Driver'])
})

test('Uzbek teacher noun forms with modifier-letter apostrophes normalize to Teacher', () => {
  const normalized = normalizeCandidate({
    id: 'ishbor-durdona', source: 'telegram', origin: 'web', sourceKey: 'ishbor-uz', country: 'UZ',
    name: 'Durdona', role: 'Oʻqituvchilik', professions: ['Oʻqituvchilik'],
    city: 'Tashkent', experienceYears: 0, salaryMin: 2_000_000, salaryMax: 3_000_000, currency: 'UZS',
    url: 'https://ish-bor.uz/ru/ishchilar/id/118029', createdAt: '2026-08-19T12:00:00.000Z',
    originalText: 'Oʻqituvchilik (Резюме) - Джизак | работа в ташкенте\nГорода и области\nOʻqituvchilik\nДжизак\nУ меня нет опыта работы\nDurdona (Женщина)',
    description: 'Oʻqituvchilik\nДжизак\nУ меня нет опыта работы\nDurdona (Женщина)',
  })
  assert.deepEqual(normalized.professions, ['Teacher'])
  assert.equal(normalized.role, 'Teacher')
  assert.equal(normalized.city, 'Jizzakh')
  assert.equal(normalized.experienceYears, 0)
})

test('legacy Flagma fields repair hidden names, education and month durations', () => {
  const text = [
    'Оператор чата',
    'ФИО скрыто , 20 лет, Ташкент | Среднее образование',
    'неполная занятость, удаленно',
    'Опыт работы: 2 мес, Administrator, Language Centre, Tashkent',
  ].join('\n')
  const normalized = normalizeCandidate({
    id: 'flagma-8199',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'flagma-uz',
    country: 'UZ',
    name: 'ФИО скрыто',
    role: 'Оператор чата',
    education: 'неполная занятость, удаленно',
    employmentTypes: ['full_time', 'part_time'],
    professionExperience: [{ profession: 'Administrator', years: 2 }],
    url: 'https://flagma.uz/ru/resume-operator-chata-rr8199.html',
    createdAt: '2026-08-22T12:00:00.000Z',
    originalText: text,
    description: text,
  })
  const repaired = withProfessionExperience(normalized)

  assert.equal(repaired.name, '')
  assert.equal(repaired.education, 'Среднее образование')
  assert.deepEqual(repaired.employmentTypes, ['part_time'])
  assert.equal(repaired.professionExperience?.find((item) => item.profession === 'Administrator')?.years, 0.2)
})

test('IshBor keeps only the profile column and trusts its stated region', () => {
  const html = [
    '<nav>работа в Ташкенте</nav>',
    '<div class="flex"><div class="w-full lg:w-2/3">',
    '<h1>Електрик</h1><iconify-icon icon="lucide:map-pin"></iconify-icon><span>Сурхандаря</span>',
    '<iconify-icon icon="lucide:clock"></iconify-icon><span>У меня нет опыта работы</span>',
    '</div><div class="w-full lg:w-1/3">Вакансии Ташкент</div></div>',
    '<footer>Меню Войти Регистрация</footer>',
  ].join('')
  const profileHtml = ishBorProfileHtml(html)

  assert.match(profileHtml, /Електрик|Сурхандаря/)
  assert.doesNotMatch(profileHtml, /работа в Ташкенте|Вакансии Ташкент|Регистрация/)

  const legacyText = [
    'Електрик (Резюме) - Сурхандаря | работа в ташкенте',
    'ish bor.uz',
    'Фильтр',
    'Города и области',
    'Електрик',
    'Постоянный',
    'Сурхандаря',
    'У меня нет опыта работы',
    'Dilshodbek (Мужчина)',
    '21.08.2026',
    'ish-bor.uz',
    'Если вам нужна работа или работник',
    'Войти',
    'Регистрация',
  ].join('\n')

  assert.equal(ishBorLocationFromText(legacyText), 'Surkhandarya')
  assert.equal(trimIshBorProfileText(legacyText), [
    'Електрик',
    'Постоянный',
    'Сурхандаря',
    'У меня нет опыта работы',
    'Dilshodbek (Мужчина)',
    '21.08.2026',
  ].join('\n'))

  const repaired = normalizeCandidate({
    id: 'web-ishbor-uz-118053',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'ishbor-uz',
    country: 'UZ',
    name: 'Dilshodbek',
    role: 'Электрик',
    city: 'Tashkent',
    experienceYears: 0,
    url: 'https://ish-bor.uz/ru/ishchilar/id/118053',
    createdAt: '2026-08-21T12:00:00.000Z',
    originalText: legacyText,
    description: legacyText,
  })
  assert.equal(repaired.city, 'Surkhandarya')
  assert.equal(repaired.experienceYears, 0)
  assert.doesNotMatch(repaired.description, /Фильтр|Если вам нужна работа|Регистрация/)

  assert.equal(ishBorLocationFromText(
    "Oliy toifali boshlang'ich ta'lim o'qituvchisi (Резюме) - Навои | работа в ташкенте",
  ), 'Navoi')

  const tashkentRegionLegacy = [
    'Tarjimon (Резюме) - Ташкент обл. | работа в ташкенте',
    'Города и области',
    'Tarjimon',
    'Не важно',
    '8 000 000-15 000 000',
    'Ташкент обл.',
    'Другие',
    'У меня нет опыта работы',
    'Abror (Мужчина)',
    'Средний',
    '19.08.2026',
    'ish-bor.uz',
    'Если вам нужна работа или работник, посетите наш сайт',
    'Войти',
  ].join('\n')
  const tashkentRegionProfile = normalizeCandidate({
    id: 'web-ishbor-uz-118025',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'ishbor-uz',
    country: 'UZ',
    name: 'Abror',
    role: 'Translator',
    professions: ['Translator'],
    city: 'Tashkent',
    experienceYears: 0,
    salaryMin: 8_000_000,
    salaryMax: 15_000_000,
    currency: 'UZS',
    url: 'https://ish-bor.uz/ru/ishchilar/id/118025',
    createdAt: '2026-08-19T12:00:00.000Z',
    originalText: tashkentRegionLegacy,
    description: tashkentRegionLegacy,
  })
  assert.equal(tashkentRegionProfile.city, 'Tashkent Region')
  assert.equal(tashkentRegionProfile.experienceYears, 0)
  assert.equal(tashkentRegionProfile.salaryMin, 8_000_000)
  assert.equal(tashkentRegionProfile.salaryMax, 15_000_000)
  assert.doesNotMatch(tashkentRegionProfile.description, /работа в ташкенте|Если вам нужна работа|Войти/iu)
})

test('Uzbek boards that print a region instead of a city still resolve a location', () => {
  assert.equal(cityFrom('Резюме - Кашкадаря', 'UZ'), 'Kashkadarya')
  assert.equal(cityFrom('Qoraqalpog’iston', 'UZ'), 'Karakalpakstan')
  assert.equal(cityFrom('Яшнабад, Ташкент', 'UZ'), 'Tashkent')
})

test('web CV mirrors with reordered role text collapse to one candidate', () => {
  const base = {
    source: 'Talent.UA',
    sourceKey: 'talent-ua',
    origin: 'web',
    country: 'UA',
    name: 'Игорь',
    city: 'Kharkiv',
    professions: ['Marketer'],
    salaryMin: 20_000,
    salaryMax: 20_000,
    currency: 'UAH',
    createdAt: '2026-08-20T10:00:00.000Z',
  }
  const candidates = dedupeCandidates([
    { ...base, id: 'a', role: 'Специалист по рекламе, PR и маркетингу', url: 'https://talent.ua/a' },
    { ...base, id: 'b', role: 'Специалист по маркетингу, рекламе, PR', url: 'https://talent.ua/b' },
  ])
  assert.equal(candidates.length, 1)
})

test('a candidate who accepts any work is classified as a general laborer', () => {
  for (const role of ["Farqi yo'q.", 'Нет разницы', 'Не важно']) {
    const profile = normalizeCandidate({
      id: `flexible-${role}`,
      source: 'Flagma UZ',
      sourceKey: 'flagma-uz',
      origin: 'web',
      country: 'UZ',
      name: 'Candidate',
      role,
      professions: [role],
      url: 'https://example.com/candidate',
      createdAt: '2026-08-22T10:00:00.000Z',
      originalText: `${role}\nCandidate, 30 лет, Ташкент`,
      description: `${role}\nCandidate, 30 лет, Ташкент`,
    })
    assert.equal(profile.role, 'General Laborer')
    assert.deepEqual(profile.professions, ['General Laborer'])
  }
})

test('an obvious developer profile without a stated role becomes Software Developer', () => {
  const profile = repairCandidateProfile(normalizeCandidate({
    id: 'developer-without-role',
    source: 'Telegram',
    sourceKey: 'telegram',
    origin: 'telegram',
    country: 'UA',
    name: '',
    role: '',
    skills: ['React'],
    url: 'https://t.me/example/1',
    createdAt: '2026-08-22T10:00:00.000Z',
    originalText: '#react\nШукаю нові можливості. Портфоліо та CV надішлю приватно.',
    description: '#react\nШукаю нові можливості. Портфоліо та CV надішлю приватно.',
  }))
  assert.equal(profile.role, 'Software Developer')
  assert.deepEqual(profile.professions, ['Software Developer'])
})
