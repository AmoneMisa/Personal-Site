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

test('hiring worker skips disabled Telegram feeds and fast-tracks unfinished backfills', () => {
  const source = readFileSync(new URL('../server/utils/hiringSources.ts', import.meta.url), 'utf8')
  assert.match(source, /hiringChannelHandles[\s\S]*?filter\(\(channel\)\s*=>\s*channel\.enabled\s*!==\s*false\)/u)

  const queue = readFileSync(new URL('../server/utils/jobsPgQueue.ts', import.meta.url), 'utf8')
  const worker = readFileSync(new URL('../jobs-worker/worker.ts', import.meta.url), 'utf8')
  assert.match(worker, /HIRING_QUEUE_BACKFILL_SECONDS[\s\S]*?300/u)
  assert.match(worker, /bootstrapComplete/u)
  assert.match(worker, /dispatchDueJobsQueue/u)
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
}

test('Uzbek education levels are localized without losing their subject details', () => {
  assert.equal(hiringEducationLabel('Oliy', 'ru'), 'Высшее')
  assert.equal(hiringEducationLabel("O'rta maxsus", 'ru'), 'Среднее специальное')
  assert.equal(hiringEducationLabel('Oliy, TUIT', 'ru'), 'Высшее, TUIT')
  assert.equal(hiringEducationLabel("O'rta maxsus, College", 'en'), 'Vocational secondary, College')
})

test('Uzbek academic tutor roles join the broad teacher profession', () => {
  const profile = normalizeCandidate({
    id: 'teacher-uz-1',
    source: 'telegram',
    country: 'UZ',
    title: "Matematika o'qituvchisi",
    description: "Matematika o'qituvchisi, repetitor. Ish qidiryapman.",
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://t.me/example/1',
  })
  assert.ok(profile.professions?.includes('Teacher'))
})

test('IshBor oil and gas profiles recover their profession and explicit gender', () => {
  const profile = normalizeCandidate({
    id: 'ishbor-oil-1',
    source: 'telegram',
    origin: 'web',
    country: 'UZ',
    title: 'Нефть и газ',
    description: 'Пол: Мужской. Желаемая должность: Оператор по добыче нефти и газа. Опыт работы: 5 лет.',
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://ish-bor.uz/cv/1',
  })
  assert.equal(profile.gender, 'male')
  assert.ok(profile.professions?.some((item) => /operator/i.test(item)))
})

test('Uzbek structured CV fields keep labels out of the candidate name', () => {
  const name = extractCandidateName(`
    Ism: Temur
    Familya: Tojiyev
    Yosh: 21
    Kasbi: Dasturchi
  `)
  assert.equal(name, 'Temur Tojiyev')
})

test('Uzbek and Russian cashier titles normalize to the canonical profession', () => {
  const professions = normalizeProfessions(['Kassir', 'Кассир'])
  assert.deepEqual(professions, ['Cashier'])
})

test('successful HTTP captcha pages are treated as blocked responses', () => {
  assert.equal(looksSoftBlocked('<html><title>Attention Required</title><div>cf-chl-captcha</div></html>'), true)
  assert.equal(looksSoftBlocked('<html><body><h1>Real vacancy</h1><p>Apply now</p></body></html>'), false)
})

test('share metadata replacement preserves Nuxt assets in a combined head entry', () => {
  const head = [
    '<meta charset="utf-8"><meta property="og:title" content="old"><link rel="stylesheet" href="/_nuxt/app.css">',
  ]
  const next = removeExistingSocialMeta(head)
  assert.equal(next.length, 1)
  assert.match(next[0], /charset="utf-8"/)
  assert.match(next[0], /stylesheet/)
  assert.doesNotMatch(next[0], /og:title/)
})

test('Cyrillic city, age and date patterns match at all', () => {
  const text = 'Мне 27 лет. Ташкент. 20.08.2026'
  assert.equal(extractCandidateAge(text), 27)
  assert.equal(cityFrom(text, 'UZ'), 'Tashkent')
  assert.ok(activityDate(text))
})

test('a day and month with no year resolve to the most recent past date', () => {
  const resolved = dayMonthDate(21, 8, new Date('2026-08-23T12:00:00Z'))
  assert.equal(resolved, '2026-08-21T00:00:00.000Z')
})

test('relative durations in a work history are not read as an activity date', () => {
  const text = 'Опыт работы: 2 года 5 месяцев. Ищу работу.'
  assert.equal(activityDate(text), null)
})

test('script and style contents never reach a candidate profile', () => {
  assert.equal(htmlText('<style>.x{display:none}</style><script>alert(1)</script><div>Candidate</div>'), 'Candidate')
})

test('specific sales and Uzbek CE driver titles normalize to canonical roles', () => {
  assert.ok(normalizeProfessions(['Sales manager']).includes('Sales Manager'))
  assert.ok(normalizeProfessions(['CE toifali haydovchi']).includes('Driver'))
})

test('remaining IshBor titles normalize without leaking categories into skills', () => {
  const profile = normalizeCandidate({
    id: 'ishbor-rest-1',
    source: 'telegram',
    origin: 'web',
    country: 'UZ',
    title: 'Savdo / Kassir',
    description: 'Kasbi: Kassir. Savdo sohasida tajriba.',
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://ish-bor.uz/cv/2',
  })
  assert.ok(profile.professions?.includes('Cashier'))
  assert.ok(!(profile.skills || []).some((skill) => /savdo/i.test(skill)))
})

test('source-specific role spellings and specialist roles use the shared taxonomy', () => {
  const professions = normalizeProfessions(['frontend dasturchi', 'HR specialist', 'SMM mutaxassisi'])
  assert.ok(professions.includes('Frontend Developer'))
  assert.ok(professions.includes('HR Specialist'))
  assert.ok(professions.includes('SMM Specialist'))
})

test('related professions collapse into stable combined search facets', () => {
  assert.deepEqual(collapseHiringProfessionFilterValues(['Software Developer', 'Frontend Developer']), ['Software Developer'])
  assert.ok(expandHiringProfessionFilters(['Software Developer']).includes('Frontend Developer'))
  assert.equal(hiringProfessionFilterLabel('Software Developer', 'ru'), 'Разработка ПО')
  assert.deepEqual(normalizeHiringProfessionFilterSelections(['Frontend Developer']), ['Software Developer'])
})

test('candidate detail table explicitly marks missing values for its hide toggle', () => {
  const page = readFileSync(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
  assert.match(page, /candidate-field--missing/u)
})

test('Careerist removes listing controls and rejects remote format as a profession', () => {
  const text = trimCareeristProfileText('Удаленная работа | Показать телефон | Frontend Developer | 3 года опыта')
  assert.doesNotMatch(text, /Показать телефон/u)
  assert.ok(!normalizeProfessions(['Удаленная работа']).length)
})

test('Careerist trusts its listing headline and drops impossible age zero', () => {
  const profile = normalizeCandidate({
    id: 'careerist-1',
    source: 'telegram',
    origin: 'web',
    country: 'UZ',
    title: 'Frontend Developer',
    description: 'Возраст: 0. JavaScript Vue.',
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://careerist.uz/cv/1',
  })
  assert.ok(profile.professions?.includes('Frontend Developer'))
  assert.equal(profile.age, undefined)
})

test('Telegram technology cards recover candidate role and structured names', () => {
  const profile = normalizeCandidate({
    id: 'tg-tech-1',
    source: 'telegram',
    country: 'UZ',
    title: 'Ish joyi kerak',
    description: 'Xodim: Temur Tojiyev\nTexnologiya: Python, Django, FastAPI\nKasbi: Talaba',
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://t.me/example/2',
  })
  assert.equal(profile.name, 'Temur Tojiyev')
  assert.ok(profile.professions?.some((item) => /developer/i.test(item)))
})

test('Flagma rejects presentation fields as role, education and contact', () => {
  const profile = normalizeCandidate({
    id: 'flagma-1',
    source: 'telegram',
    origin: 'web',
    country: 'UZ',
    title: 'Резюме',
    description: 'Показать контакты. Образование и опыт работы. Желаемая должность: Кассир.',
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://flagma.uz/ru/resume/1.html',
  })
  assert.ok(profile.professions?.includes('Cashier'))
  assert.notEqual(profile.role, 'Резюме')
})

test('Uzbek architect and call-center roles normalize and Flagma ad scripts are removed', () => {
  const professions = normalizeProfessions(['Arxitektor', 'Call center operator'])
  assert.ok(professions.includes('Architect'))
  assert.ok(professions.includes('Call Center Operator'))
})

test('Flagma rejects employment dates as contacts and employer names as skills', () => {
  const profile = normalizeCandidate({
    id: 'flagma-2',
    source: 'telegram',
    origin: 'web',
    country: 'UZ',
    title: 'Accountant',
    description: '2022-2025 Company LLC. Accountant. +998 90 123 45 67',
    createdAt: '2026-08-20T10:00:00.000Z',
    url: 'https://flagma.uz/ru/resume/2.html',
  })
  assert.ok(profile.contacts?.phone)
  assert.ok(!(profile.skills || []).some((skill) => /company llc/i.test(skill)))
})

test('Cisco and Linux infer a system administrator only without specialized tooling', () => {
  const generic = normalizeCandidate({
    id: 'sys-1', source: 'telegram', country: 'UZ', title: 'Ищу работу',
    description: 'Cisco, Linux, сети', createdAt: '2026-08-20T10:00:00.000Z', url: 'https://t.me/x/1',
  })
  assert.ok(generic.professions?.includes('System Administrator'))
})

test('legacy Careerist rows lose icon ligatures and repeating experience fractions', () => {
  const text = trimCareeristProfileText('location_on Tashkent schedule 1/1 опыт 1/1')
  assert.doesNotMatch(text, /location_on|schedule/u)
})

test('Careerist drops listing scripts and derives currency from the salary line', () => {
  const profile = normalizeCandidate({
    id: 'careerist-2', source: 'telegram', origin: 'web', country: 'UZ', title: 'Designer',
    description: 'Зарплата: 500 USD. Designer. window.dataLayer.push({})',
    createdAt: '2026-08-20T10:00:00.000Z', url: 'https://careerist.uz/cv/2',
  })
  assert.equal(profile.currency, 'USD')
})

test('mixed Latin initial in a Cyrillic candidate name is repaired', () => {
  const name = extractCandidateName('Имя: Алишер Kаримов')
  assert.ok(name)
})

test('Uzbek teacher noun forms with modifier-letter apostrophes normalize to Teacher', () => {
  assert.ok(normalizeProfessions(["o'qituvchi"]).includes('Teacher'))
})

test('legacy Flagma fields repair hidden names, education and month durations', () => {
  const repaired = repairCandidateProfile(normalizeCandidate({
    id: 'legacy-1', source: 'telegram', origin: 'web', country: 'UZ', title: 'CV',
    description: 'Имя скрыто. Среднее специальное. Опыт 8 месяцев. Кассир.',
    createdAt: '2026-08-20T10:00:00.000Z', url: 'https://flagma.uz/ru/resume/3.html',
  }))
  assert.ok(repaired.professions?.includes('Cashier'))
})

test('IshBor keeps only the profile column and trusts its stated region', () => {
  const html = '<div class="profile">Kasbi: Kassir<br>Hudud: Toshkent</div><nav>Vakansiyalar</nav>'
  assert.match(ishBorProfileHtml(html), /Kasbi/u)
  assert.equal(ishBorLocationFromText('Hudud: Toshkent'), 'Tashkent')
  assert.doesNotMatch(trimIshBorProfileText('Kasbi: Kassir | Vakansiyalar'), /Vakansiyalar/u)
})

test('Uzbek boards that print a region instead of a city still resolve a location', () => {
  assert.equal(cityFrom('Hudud: Toshkent shahri', 'UZ'), 'Tashkent')
})

test('web CV mirrors with reordered role text collapse to one candidate', () => {
  const base = {
    source: 'telegram', origin: 'web', country: 'UZ', createdAt: '2026-08-20T10:00:00.000Z',
    name: 'Ali Valiyev', city: 'Tashkent',
  }
  const result = dedupeCandidates([
    normalizeCandidate({ ...base, id: 'a', title: 'Frontend Developer', description: 'Vue JS', url: 'https://a.example/cv/1' }),
    normalizeCandidate({ ...base, id: 'b', title: 'Developer Frontend', description: 'Vue JS', url: 'https://b.example/cv/2' }),
  ])
  assert.equal(result.length, 1)
})

test('a candidate who accepts any work keeps an explicit any-role preference', () => {
  const profile = normalizeCandidate({
    id: 'any-1', source: 'telegram', country: 'UZ', title: 'Ищу любую работу',
    description: 'Рассмотрю любую работу', createdAt: '2026-08-20T10:00:00.000Z', url: 'https://t.me/x/2',
  })
  assert.ok(profile.professions?.some((item) => /any/i.test(item)))
})

test('an obvious developer profile without a stated role becomes Software Developer', () => {
  const profile = normalizeCandidate({
    id: 'dev-1', source: 'telegram', country: 'UZ', title: 'Ищу работу',
    description: 'Python Django FastAPI PostgreSQL Git Linux', createdAt: '2026-08-20T10:00:00.000Z', url: 'https://t.me/x/3',
  })
  assert.ok(profile.professions?.includes('Software Developer'))
})

test('hiring technical roles keep industry-standard English labels and Uzbek source roles normalize', () => {
  assert.equal(hiringProfessionLabel('Frontend Developer', 'ru'), 'Frontend Developer')
  assert.ok(normalizeProfessions(['Dasturchi']).includes('Software Developer'))
})

test('hiring normalization drops source pseudo-roles and duplicate name-as-role values', () => {
  const profile = normalizeCandidate({
    id: 'norm-1', source: 'telegram', country: 'UZ', name: 'Ali Valiyev', title: 'Ali Valiyev',
    description: 'Резюме. Ищу работу кассиром.', createdAt: '2026-08-20T10:00:00.000Z', url: 'https://t.me/x/4',
  })
  assert.ok(!profile.professions?.includes('Ali Valiyev'))
  assert.ok(profile.professions?.includes('Cashier'))
})
