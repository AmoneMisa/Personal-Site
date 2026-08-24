import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { hiringEducationLabel } from '../shared/hiringEducationLabels.ts'
import { hiringProfessionLabel } from '../shared/hiringProfessionLabels.ts'
import {
  collapseHiringProfessionFilterValues,
  expandHiringProfessionFilters,
  hiringProfessionFilterLabel,
  normalizeHiringProfessionFilterSelections,
} from '../shared/hiringProfessionGroups.ts'

import {
  extractCandidateAge,
  extractCandidateGender,
  extractCandidateName,
} from '../server/utils/hiringCandidateFields.ts'
import { removeExistingSocialMeta } from '../server/utils/shareHead.ts'
import { looksSoftBlocked } from '../server/utils/browserSoftBlock.ts'
import { dedupeCandidates, normalizeCandidate, normalizeProfessions } from '../server/utils/hiringNormalize.ts'
import { repairCandidateProfile } from '../server/utils/hiringQuality.ts'
import { withProfessionExperience } from '../server/utils/hiringExperience.ts'
import { trimCareeristProfileText } from '../server/utils/hiringCareeristFields.ts'
import { parseUzJobsRows } from '../server/utils/hiringUzJobsFields.ts'
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

test('hiring dispatcher skips disabled Telegram feeds and fast-tracks unfinished backfills', () => {
  const source = readFileSync(new URL('../server/utils/hiringSources.ts', import.meta.url), 'utf8')
  assert.match(source, /hiringChannelHandles[\s\S]*?filter\(\(channel\)\s*=>\s*channel\.enabled\s*!==\s*false\)/u)

  const queue = readFileSync(new URL('../shared/jobs/jobsPgQueue.ts', import.meta.url), 'utf8')
  const dispatch = readFileSync(new URL('../server/routes/internal/jobs-queue-dispatch.post.ts', import.meta.url), 'utf8')
  assert.match(dispatch, /HIRING_QUEUE_BACKFILL_SECONDS[\s\S]*?300/u)
  assert.match(queue, /backfill_due_at/u)
  assert.match(queue, /type = 'hiring\.refresh\.channel'[\s\S]*?status IN \('pending', 'running'\)/u)
  assert.match(queue, /priority: 4/u)
})

test('UzJobs public anonymous resume rows become recent platform-contact candidates', () => {
  const html = `
    <table>
      <tr>
        <td class="td_left_id">99924</td>
        <td>Наука, образование / Главный специалист<br>Наука, образование / Преподаватель</td>
        <td class="td_region" align="center">Ташкент</td>
        <td class="td_kol_vak">16.08.2026 13:25:13</td>
      </tr>
    </table>
  `
  const [row] = parseUzJobsRows(html)
  assert.ok(row)
  assert.equal(row.id, '99924')
  assert.deepEqual(row.roles, ['Главный специалист', 'Преподаватель'])
  assert.equal(row.region, 'Ташкент')
  assert.equal(row.activityAt, '2026-08-16T08:25:13.000Z')
})

test('the search clear button clears and refreshes all three boards', () => {
  const pages = [
    '../app/pages/flat-finder/index.vue',
    '../app/pages/jobs/index.vue',
    '../app/pages/hiring/index.vue',
  ]
  for (const page of pages) {
    const source = readFileSync(new URL(page, import.meta.url), 'utf8')
    assert.match(source, /<u-input\s+v-model="query"[^>]*\bclearable\b[^>]*@clear="clearSearch"/u)
    assert.match(source, /function\s+clearSearch\s*\([^)]*\)\s*\{[\s\S]*?query\.value\s*=\s*"";[\s\S]*?scheduleLoad\(0\)/u)
  }

  const input = readFileSync(new URL('../app/components/U/Input.vue', import.meta.url), 'utf8')
  assert.match(input, /@mousedown\.stop\.prevent/u)
  assert.match(input, /@click\.stop\.prevent="clear"/u)
})

test('board pages share filter primitives and flat finder starts from a regional country', () => {
  const flat = readFileSync(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
  const hiring = readFileSync(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
  const jobs = readFileSync(new URL('../app/pages/jobs/index.vue', import.meta.url), 'utf8')
  for (const source of [flat, hiring, jobs]) {
    assert.match(source, /<UiFilterFooter/u)
    assert.match(source, /<UiSearchViewTabs/u)
  }
  assert.match(hiring, /<UiFilterSection/u)
  assert.match(jobs, /<UiFilterSection/u)
  assert.match(flat, /timeZone\.startsWith\("Asia\/"\)\s*\?\s*"UZ"\s*:\s*"UA"/u)
  assert.match(flat, /countries\.value\s*=\s*\[defaultCountry\.value\]/u)
})

test('OLX listing verification exposes a localized in-card loader', () => {
  const flat = readFileSync(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
  const ru = JSON.parse(readFileSync(new URL('../i18n/locales/ru.json', import.meta.url), 'utf8'))
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
  assert.match(flat, /checkingListingKey\.value\s*=\s*key[\s\S]*?await verifyOlxListing/u)
  assert.match(flat, /class="flat-card__checking"[\s\S]*?t\("checkingListing"\)/u)
  assert.ok(ru.flats.checkingListing)
  assert.ok(en.flats.checkingListing)
})

test('flat finder exposes photo-only and room-rent filters', () => {
  const flat = readFileSync(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
  const ru = JSON.parse(readFileSync(new URL('../i18n/locales/ru.json', import.meta.url), 'utf8'))
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
  assert.match(flat, /const onlyWithPhotos = ref\(false\)/u)
  assert.match(flat, /value: "roomRent"/u)
  assert.match(flat, /class="flat-verification"/u)
  assert.ok(ru.flats.onlyWithPhotos && ru.flats.dtRoomRent)
  assert.ok(en.flats.onlyWithPhotos && en.flats.dtRoomRent)
})

test('flat finder renders a collapsible localized statistics panel', () => {
  const flat = readFileSync(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
  const stats = readFileSync(new URL('../app/components/flats/StatsPanel.vue', import.meta.url), 'utf8')
  assert.match(flat, /<FlatsStatsPanel/u)
  assert.match(stats, /expanded = ref\(true\)/u)
  assert.match(stats, /statsWithPhotos/u)
  const ru = JSON.parse(readFileSync(new URL('../i18n/locales/ru.json', import.meta.url), 'utf8'))
  assert.equal(ru.flats.statsTitle, 'Статистика объявлений')
})

test('country quiz result cards use a responsive four-column grid', () => {
  const quiz = readFileSync(new URL('../app/pages/quizzes/country-fit/index.vue', import.meta.url), 'utf8')
  assert.match(quiz, /@media \(min-width: 1180px\)[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/u)
  assert.doesNotMatch(quiz, /grid-cols-1 md:grid-cols-3 gap-3/u)
})

test('Uzbek education levels are localized without losing their subject details', () => {
  assert.equal(hiringEducationLabel("O'rta", 'ru'), 'Среднее')
  assert.equal(hiringEducationLabel('Oliy', 'ru'), 'Высшее')
  assert.equal(hiringEducationLabel("O'rta maxsus", 'ru'), 'Среднее специальное')
  assert.equal(hiringEducationLabel("Oliy(Ona tili va adabiyot)", 'ru'), 'Высшее (Ona tili va adabiyot)')
  assert.equal(hiringEducationLabel("O'rta", 'en'), 'Secondary education')
})

test('Uzbek academic tutor roles join the broad teacher profession', () => {
  assert.deepEqual(normalizeProfessions('Tyutorlik', ''), ['Teacher'])
  assert.deepEqual(normalizeProfessions('Тьютор', ''), ['Teacher'])
  assert.deepEqual(normalizeProfessions('Репетитор', ''), ['Tutor'])
})

test('IshBor oil and gas profiles recover their profession and explicit gender', () => {
  assert.deepEqual(normalizeProfessions('Neft vagaz sohasida', ''), ['Oil & Gas Worker'])
  assert.equal(hiringProfessionLabel('Oil & Gas Worker', 'ru'), 'Работник нефтегазовой отрасли')
  assert.equal(extractCandidateGender('Sanjar Rahmatov (Мужчина)'), 'male')
  assert.equal(extractCandidateGender('Dilafruz (Ayol)'), 'female')

  const profile = normalizeCandidate({
    id: 'ishbor-gender',
    source: 'telegram',
    origin: 'web',
    sourceKey: 'ishbor-uz',
    country: 'UZ',
    name: 'Sanjar Rahmatov',
    role: 'Neft vagaz sohasida',
    professions: ['Neft vagaz sohasida'],
    url: 'https://ish-bor.uz/ru/ishchilar/id/118057',
    createdAt: '2026-08-21T12:00:00.000Z',
    originalText: 'Neft vagaz sohasida\nSanjar Rahmatov (Мужчина)\nВысший',
    description: 'Neft vagaz sohasida\nSanjar Rahmatov (Мужчина)\nВысший',
  })
  assert.equal(profile.role, 'Oil & Gas Worker')
  assert.equal(profile.gender, 'male')
})

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
  assert.equal(dayMonthDate('5 лет'), null)
})

test('relative durations in a work history are not read as an activity date', () => {
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

test('remaining IshBor titles normalize without leaking categories into skills', () => {
  assert.deepEqual(normalizeProfessions('xavfsizlik, qoriqlash', ''), ['Security Guard'])
  assert.deepEqual(normalizeProfessions('Bank,soliq , universitetda titur', ''), [
    'Finance / Banking Specialist',
    'Teacher',
  ])
  assert.deepEqual(normalizeProfessions('Kompyuter boyicha ish', ''), ['IT Specialist'])
  assert.deepEqual(normalizeProfessions('Biotexnolog, laborant', ''), [
    'Biotechnologist',
    'Laboratory Technician',
  ])
  assert.equal(hiringProfessionLabel('Security Guard', 'ru'), 'Охранник')
  assert.equal(hiringProfessionLabel('IT Specialist', 'ru'), 'IT-специалист')

  const normalized = normalizeCandidate({
    id: 'ishbor-dilnura', source: 'ishbor-uz', origin: 'web', sourceKey: 'ishbor-uz', country: 'UZ',
    name: 'Dilnura', role: 'Kompyuter boyicha ish', skills: ['Sales', 'Procurement'],
    url: 'https://ish-bor.uz/ru/ishchilar/id/118046', createdAt: '2026-08-21T12:00:00.000Z',
    originalText: 'Kompyuter boyicha ish\nТорговля, Продажи, Закупки\n1 год\nDilnura (Женщина)',
    description: 'Kompyuter boyicha ish\nТорговля, Продажи, Закупки\n1 год\nDilnura (Женщина)',
  })
  assert.deepEqual(normalized.professions, ['IT Specialist'])
  assert.deepEqual(normalized.skills, [])
})

test('source-specific role spellings and specialist roles use the shared taxonomy', () => {
  assert.deepEqual(normalizeProfessions('Matbuot', ''), ['Media Specialist'])
  assert.deepEqual(normalizeProfessions('Injiner', ''), ['Engineer'])
  assert.deepEqual(normalizeProfessions('Chat operatori', ''), ['Chat Operator'])
  assert.deepEqual(normalizeProfessions('Консультант (без разницы)', ''), ['Consultant'])
  assert.deepEqual(normalizeProfessions('Начальник отряд', ''), ['Supervisor'])
  assert.deepEqual(normalizeProfessions('Инспектор по качеству (пищевое производство)', ''), ['Quality Inspector'])
  assert.equal(hiringProfessionLabel('Network Administrator', 'ru'), 'Сетевой администратор')
  assert.equal(hiringProfessionLabel('System Administrator', 'ru'), 'Системный администратор')
  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Pentester')
})

test('legacy profession groups expand while explicit selections stay exact', () => {
  assert.deepEqual(normalizeProfessions('Главный бухгалтер', ''), ['Chief Accountant'])
  assert.deepEqual(normalizeProfessions('Казначей', ''), ['Treasurer'])

  const accounting = expandHiringProfessionFilters(['group:accounting-finance'])
  assert.ok(accounting.includes('Accountant'))
  assert.ok(accounting.includes('Chief Accountant'))
  assert.ok(accounting.includes('Treasurer'))

  const sales = expandHiringProfessionFilters(['group:sales-retail'])
  assert.ok(sales.includes('Consultant'))
  assert.ok(sales.includes('Cashier'))
  assert.ok(sales.includes('Salesperson'))

  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Accountant', 'Chief Accountant', 'Cashier', 'Engineer']),
    ['Accountant', 'Chief Accountant', 'Cashier', 'Engineer'],
  )
  assert.deepEqual(normalizeHiringProfessionFilterSelections(['Treasurer']), ['Treasurer'])
  assert.equal(hiringProfessionFilterLabel('group:sales-retail', 'ru'), 'Продажи / Ритейл')
})

test('candidate detail table explicitly marks missing values for its hide toggle', () => {
  const component = readFileSync(new URL('../app/components/ui/SpecTable.vue', import.meta.url), 'utf8')
  const hiringPage = readFileSync(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
  assert.match(component, /empty\?: boolean/u)
  assert.match(component, /!row\.empty/u)
  assert.match(hiringPage, /empty: profile\.remote == null/u)
  assert.match(hiringPage, /empty: !profile\.languages\?\.length/u)
})

test('Careerist removes listing controls and rejects remote format as a profession', () => {
  const text = [
    '21 августа, 2026',
    'Работа на удаленной основе',
    "Bunyod Baxrom o'g'li",
    'Город',
    'Ташкент',
    'Возраст',
    '20 лет (1 марта 2006)',
    'отправить приглашение',
    'подробнее',
    '21 августа, 2026',
  ].join('\n')
  const normalized = normalizeCandidate({
    id: 'careerist-bunyod', source: 'Careerist UZ', origin: 'web', sourceKey: 'careerist-uz', country: 'UZ',
    name: "Bunyod Baxrom o'g'li", role: 'Работа на удаленной основе',
    url: 'https://tashkent.careerist.ru/resume/example.html', createdAt: '2026-08-21T12:00:00.000Z',
    originalText: text, description: text,
  })
  assert.equal(normalized.role, '')
  assert.deepEqual(normalized.professions, [])
  assert.equal(normalized.remote, true)
  assert.doesNotMatch(normalized.originalText, /отправить приглашение|подробнее/iu)
  assert.equal((normalized.originalText.match(/21 августа, 2026/giu) || []).length, 1)

  const impossibleAge = trimCareeristProfileText([
    '21 августа, 2026',
    'Начальник склада( GERMES TEKS )',
    'Shaxboz',
    'Город',
    'Ташкент',
    'Возраст',
    '0 (22 августа 2026)',
    'отправить приглашение',
    'подробнее',
    '21 августа, 2026',
  ].join('\n'))
  assert.doesNotMatch(impossibleAge, /Возраст\n0|отправить приглашение|подробнее/iu)
  assert.deepEqual(normalizeProfessions('Начальник склада( GERMES TEKS )', ''), ['Warehouse Manager'])
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

test('Uzbek architect and call-center roles normalize and Flagma ad scripts are removed', () => {
  assert.deepEqual(normalizeProfessions('Arxitektor loyihachi', ''), ['Architect'])
  assert.deepEqual(normalizeProfessions('Koll-markaz operatori', ''), ['Call Center Operator'])
  assert.deepEqual(normalizeProfessions('Chat operatori', ''), ['Chat Operator'])

  const script = [
    'try{',
    '(adsbygoogle = window.adsbygoogle || []).push({});',
    '}catch(e){',
    'console.log(e);',
    '}',
  ].join('\n')
  const normalized = normalizeCandidate({
    id: 'flagma-call-center', source: 'telegram', origin: 'web', sourceKey: 'flagma-uz', country: 'UZ',
    role: 'Koll-markaz operatori', url: 'https://flagma.uz/ru/resume-example-rr1.html',
    createdAt: '2026-08-22T12:00:00.000Z',
    originalText: `${script}\nKoll-markaz operatori\n6 000 000 сум`,
    description: `${script}\nKoll-markaz operatori\n6 000 000 сум`,
  })

  assert.equal(normalized.role, 'Call Center Operator')
  assert.doesNotMatch(normalized.originalText, /adsbygoogle|console\.log|catch\s*\(/iu)
  assert.doesNotMatch(normalized.description, /adsbygoogle|console\.log|catch\s*\(/iu)
})

test('Flagma rejects employment dates as contacts and employer names as skills', () => {
  const text = [
    'Сохранить',
    'Koll-markaz operatori',
    'Sazonova V., 24 года, Бухара | Неполное высшее образование',
    'Опыт работы: 2 года, Administrator, Uzum market, Buxoro.',
    'Образование: Бухарский технический университет, Энергетика, Buxoro 2021 - 2023.',
  ].join('\n')
  const normalized = normalizeCandidate({
    id: 'flagma-sazonova', source: 'telegram', origin: 'web', sourceKey: 'flagma-uz', country: 'UZ',
    name: 'Sazonova V.', role: 'Koll-markaz operatori', skills: ['Uzum'], contact: '2021 - 2023',
    contactType: 'platform', url: 'https://flagma.uz/ru/resume-call-center-rr2.html',
    createdAt: '2026-08-22T12:00:00.000Z', originalText: text, description: text,
  })

  assert.equal(normalized.role, 'Call Center Operator')
  assert.equal(normalized.contact, normalized.url)
  assert.deepEqual(normalized.skills, [])
  assert.doesNotMatch(normalized.description, /^Сохранить$/mu)
})

test('Cisco and Linux infer a system administrator only without specialized tooling', () => {
  const profile = repairCandidateProfile(normalizeCandidate({
    id: 'tg-network', source: 'telegram', country: 'UZ', name: 'Akobir Azizov', role: '',
    skills: ['Cisco', 'Linux'], url: 'https://t.me/example/2', createdAt: '2026-08-22T12:00:00.000Z',
    originalText: 'Xodim: Akobir Azizov\nTexnologiya: Cisco, Linux\nMaqsad: shu soha bo‘yicha yetuk mutahasis bo‘lish',
    description: 'Xodim: Akobir Azizov\nTexnologiya: Cisco, Linux\nMaqsad: shu soha bo‘yicha yetuk mutahasis bo‘lish',
  }))

  assert.deepEqual(profile.professions, ['System Administrator'])
  assert.equal(profile.role, 'System Administrator')

  const devops = repairCandidateProfile(normalizeCandidate({
    id: 'tg-devops', source: 'telegram', country: 'UZ', name: 'Candidate', role: '',
    skills: ['Cisco', 'Linux', 'Terraform'], url: 'https://t.me/example/3', createdAt: '2026-08-22T12:00:00.000Z',
    originalText: 'Xodim: Candidate\nTexnologiya: Cisco, Linux, Terraform',
    description: 'Xodim: Candidate\nTexnologiya: Cisco, Linux, Terraform',
  }))
  assert.notEqual(devops.role, 'System Administrator')

  const developer = repairCandidateProfile(normalizeCandidate({
    id: 'tg-developer-network', source: 'telegram', country: 'UZ', name: 'Candidate', role: '',
    skills: ['Cisco', 'Linux', 'Software Developer'], url: 'https://t.me/example/4', createdAt: '2026-08-22T12:00:00.000Z',
    originalText: 'Xodim: Candidate\nTexnologiya: Cisco, Linux\nKasbi: Software Developer',
    description: 'Xodim: Candidate\nTexnologiya: Cisco, Linux\nKasbi: Software Developer',
  }))
  assert.notEqual(developer.role, 'System Administrator')
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
    'Електрик (Резюме) - Сурхандарья | работа в ташкенте',
    'ish bor.uz',
    'Фильтр',
    'Города и области',
    'Електрик',
    'Постоянный',
    'Сурхандарья',
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
    'Сурхандарья',
    'У меня нет опыта работы',
    'Dilshodbek (Мужчина)',
    '21.08.2026',
  ].join('\n'))

  const noisyProfileText = [
    'Neft vagaz sohasida',
    'Постоянный',
    '7 milliyondanyuqori',
    'Кашкадарья',
    'У меня нет опыта работы',
    'Sanjar Rahmatov (Мужчина)',
    'Высший',
    'Чтобы связаться с кандидатом, нужно войти на сайт.',
    'Уже зарегистрированы? Войти .',
    'Нет аккаунта? Регистрация .',
    '21.08.2026',
    '24',
    '0',
  ].join('\n')
  const cleanProfileText = trimIshBorProfileText(noisyProfileText)
  assert.match(cleanProfileText, /Sanjar Rahmatov \(Мужчина\)\nВысший$/u)
  assert.doesNotMatch(cleanProfileText, /связаться|зарегистрированы|аккаунта|21\.08\.2026|\n24\n0/iu)

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

  const repairedNoisy = normalizeCandidate({
    ...repaired,
    id: 'web-ishbor-uz-118057',
    role: 'Neft vagaz sohasida',
    originalText: noisyProfileText,
    description: noisyProfileText,
  })
  assert.doesNotMatch(repairedNoisy.originalText, /связаться|зарегистрированы|аккаунта|21\.08\.2026/iu)
  assert.doesNotMatch(repairedNoisy.description, /связаться|зарегистрированы|аккаунта|21\.08\.2026/iu)

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

test('a candidate who accepts any work keeps an explicit any-role preference', () => {
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
    assert.equal(profile.role, 'Any Role')
    assert.deepEqual(profile.professions, ['Any Role'])
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

test('hiring technical roles keep industry-standard English labels and Uzbek source roles normalize', () => {
  assert.equal(hiringProfessionLabel('Data Scientist', 'ru'), 'Data Scientist')
  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Pentester')
  assert.equal(hiringProfessionLabel('Data Engineer', 'ru'), 'Data Engineer')
  assert.equal(hiringProfessionLabel('QA Engineer', 'ru'), 'QA Engineer')
  assert.equal(hiringProfessionLabel('DevOps Engineer', 'ru'), 'DevOps Engineer')

  assert.deepEqual(normalizeProfessions('iqtisodchi', ''), ['Economist'])
  assert.deepEqual(normalizeProfessions('iqtsodchi', ''), ['Economist'])
  assert.deepEqual(normalizeProfessions('Iqtisodiy', ''), ['Economist'])
  assert.deepEqual(normalizeProfessions('Logist', ''), ['Logistics Specialist'])
  assert.deepEqual(normalizeProfessions('Ingliz tili ustoziman', ''), ['English Teacher'])
  assert.deepEqual(normalizeProfessions('Mobilagraf ITishnik pdf faylla frontet', ''), ['Frontend Developer'])
  assert.deepEqual(normalizeProfessions('Farqi yo qande ish bulsa hm, bolalarga qarash menga yoqadi', ''), ['Nanny'])
  assert.deepEqual(normalizeProfessions('Sales Executive IND', ''), ['Sales Manager'])
  assert.deepEqual(normalizeProfessions('РОП, Sales Executive', ''), ['Sales Manager'])
  assert.deepEqual(normalizeProfessions('Data Scientist', ''), ['Data Scientist'])
  assert.deepEqual(normalizeProfessions('Pentester', ''), ['Penetration Tester'])
})

test('hiring normalization drops source pseudo-roles and duplicate name-as-role values', () => {
  const duplicateRole = normalizeCandidate({
    id: 'ishbor-akbar', source: 'telegram', origin: 'web', sourceKey: 'ishbor-uz', country: 'UZ',
    name: 'Akbar', role: 'Akbar', professions: ['Akbar'], url: 'https://example.test/akbar',
    createdAt: '2026-08-22T12:00:00.000Z', originalText: 'Akbar\nToshkent', description: 'Akbar\nToshkent',
  })
  assert.equal(duplicateRole.role, '')
  assert.deepEqual(duplicateRole.professions, [])

  const onlineOnly = normalizeCandidate({
    id: 'flagma-online', source: 'telegram', origin: 'web', sourceKey: 'flagma-uz', country: 'UZ',
    name: 'Onlayn', role: 'Onlayn', professions: ['Onlayn'], url: 'https://example.test/online',
    createdAt: '2026-08-22T12:00:00.000Z', originalText: 'Onlayn\n21 год\nСырдарья', description: 'Onlayn\n21 год\nСырдарья',
  })
  assert.equal(onlineOnly.name, '')
  assert.equal(onlineOnly.role, '')
  assert.deepEqual(onlineOnly.professions, [])
  assert.equal(onlineOnly.remote, true)

  assert.deepEqual(normalizeProfessions('Без разницы я быстро учусь', ''), ['Any Role'])
  assert.equal(hiringProfessionLabel('Any Role', 'ru'), 'Любая работа')
})
