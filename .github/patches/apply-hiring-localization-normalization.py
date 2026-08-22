from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'expected block not found in {path}: {old[:120]!r}')
    path.write_text(text.replace(old, new, 1))


normalize = Path('server/utils/hiringNormalize.ts')

replace_once(
    normalize,
    "  { name: 'Sales Manager', re: /\\b(?:sales\\s+manager|account\\s+manager)\\b|менеджер\\s+(?:по\\s+)?(?:экспортн\\p{L}*\\s+)?продаж|менеджер\\s+з\\s+продаж|sotuv\\s+menejer/iu },",
    "  { name: 'Sales Manager', re: /\\b(?:sales\\s+(?:manager|executive|director)|account\\s+manager|head\\s+of\\s+sales)\\b|менеджер\\s+(?:по\\s+)?(?:экспортн\\p{L}*\\s+)?продаж|менеджер\\s+з\\s+продаж|руководител\\p{L}*\\s+отдела\\s+продаж|(?<!\\p{L})роп(?!\\p{L})|sotuv\\s+menejer/iu },",
)

replace_once(
    normalize,
    "  { name: 'Driver', re: /\\bdriver\\b|(?<!\\p{L})водитель(?!\\p{L})|(?<!\\p{L})водій(?!\\p{L})|\\bhaydovchi\\b|\\bshafyor\\b|(?<!\\p{L})[СC][ЕE]\\s+категори/iu },",
    "  { name: 'Driver', re: /\\bdriver\\b|(?<!\\p{L})водитель(?!\\p{L})|(?<!\\p{L})водій(?!\\p{L})|\\bhaydovchi\\b|\\bshafyor\\b|(?<!\\p{L})[СC][ЕE]\\s+категори/iu },\n  { name: 'Logistics Specialist', re: /\\b(?:logist|logistician|logistics\\s+(?:specialist|coordinator|manager))\\b|логист\\p{L}*/iu },",
)

replace_once(
    normalize,
    "  { name: 'Nanny', re: /\\bnanny\\b|няня|нянечк|enaga|bola\\s+qarash/iu },",
    "  { name: 'Nanny', re: /\\bnanny\\b|няня|нянечк|enaga|bola(?:larga)?\\s+qarash|bolaga\\s+qarash/iu },",
)

replace_once(
    normalize,
    "  { name: 'Kindergarten Teacher', re: /\\bkindergarten\\s+teacher\\b|воспитател|виховател|tarbiyachi|(?:xususiy\\s+)?bog['’ʻʼ‘`]?cha/iu },",
    "  { name: 'English Teacher', re: /\\b(?:english\\s+(?:teacher|tutor)|ingliz\\s+tili(?:dan)?\\s+(?:o['’ʻʼ‘`]?qituvchi|ustoz(?:iman)?))\\b|преподавател\\p{L}*\\s+английск|учител\\p{L}*\\s+английск/iu },\n  { name: 'Kindergarten Teacher', re: /\\bkindergarten\\s+teacher\\b|воспитател|виховател|tarbiyachi|(?:xususiy\\s+)?bog['’ʻʼ‘`]?cha/iu },",
)

replace_once(
    normalize,
    "  { name: 'Teacher', re: /\\bteacher\\b|учитель|вчитель|преподавател|викладач|тьютор|t(?:yutor|itur)(?:lik)?|o['’ʻʼ‘`]?qituvchi(?:lik)?/iu },",
    "  { name: 'Teacher', re: /\\bteacher\\b|учитель|вчитель|преподавател|викладач|тьютор|t(?:yutor|itur)(?:lik)?|o['’ʻʼ‘`]?qituvchi(?:lik)?|ustoz(?:iman)?/iu },",
)

replace_once(
    normalize,
    "  { name: 'Frontend Developer', re: /\\bfront[- ]?end\\s+(?:developer|engineer|dasturchi)\\b|\\bfrontend\\s+dasturchi\\b|фронтенд/iu },",
    "  { name: 'Frontend Developer', re: /\\b(?:front[- ]?end|frontend|frontet|frontent|fronend)(?:\\s+(?:developer|engineer|dasturchi))?\\b|фронтенд/iu },",
)

replace_once(
    normalize,
    "  { name: 'IT Specialist', re: /\\bit\\s+specialist\\b|it[-\\s]?специалист|специалист\\s+по\\s+it|kompyuter\\s+bo(?:['’ʻʼ‘`]?yicha|yicha)\\s+ish/iu },",
    "  { name: 'IT Specialist', re: /\\bit\\s+specialist\\b|it[-\\s]?специалист|специалист\\s+по\\s+it|\\bit(?:ishnik|[-\\s]?shnik)\\b|айтишник|kompyuter\\s+bo(?:['’ʻʼ‘`]?yicha|yicha)\\s+ish/iu },",
)

replace_once(
    normalize,
    "  { name: 'Cybersecurity Specialist', re: /\\b(?:cybersecurity|cyber\\s+security|ciso)\\b|информационн\\p{L}*\\s+безопасност|axborot\\s+xavfsizligi/iu },\n  { name: 'Engineering Manager', re: /\\b(?:cto|vp\\s+of\\s+engineering|head\\s+of\\s+engineering|engineering\\s+manager)\\b|техническ\\p{L}*\\s+директор/iu },",
    "  { name: 'Cybersecurity Specialist', re: /\\b(?:cybersecurity|cyber\\s+security|ciso)\\b|информационн\\p{L}*\\s+безопасност|axborot\\s+xavfsizligi/iu },\n  { name: 'Penetration Tester', re: /\\b(?:penetration\\s+tester|pentester|ethical\\s+hacker)\\b|пентестер/iu },\n  { name: 'AI / ML Engineer', re: /\\b(?:(?:ai|ml|machine\\s+learning)\\s+(?:engineer|developer)|machine\\s+learning\\s+specialist)\\b|инженер\\s+(?:машинного\\s+обучения|ии)/iu },\n  { name: 'Data Scientist', re: /\\bdata\\s+scientist\\b|\\bdata\\s+science\\b|дата[-\\s]?сайентист/iu },\n  { name: 'Data Engineer', re: /\\bdata\\s+engineer\\b|инженер\\s+данных/iu },\n  { name: 'Engineering Manager', re: /\\b(?:cto|vp\\s+of\\s+engineering|head\\s+of\\s+engineering|engineering\\s+manager)\\b|техническ\\p{L}*\\s+директор/iu },",
)

replace_once(
    normalize,
    "  { name: 'Metrology Specialist', re: /\\bmetrolog(?:y|iya)\\b|метролог|standartlashtirish/iu },\n  { name: 'Finance / Banking Specialist', re: /\\b(?:finance|banking)\\s+specialist\\b|специалист\\s+по\\s+(?:финанс|банков)|moliya|(?<!\\p{L})bank(?!\\p{L})|soliq/iu },",
    "  { name: 'Metrology Specialist', re: /\\bmetrolog(?:y|iya)\\b|метролог|standartlashtirish/iu },\n  { name: 'Economist', re: /\\beconomist\\b|экономист|(?<!\\p{L})iqt(?:i)?sod(?:chi|iy)(?!\\p{L})/iu },\n  { name: 'Finance / Banking Specialist', re: /\\b(?:finance|banking)\\s+specialist\\b|специалист\\s+по\\s+(?:финанс|банков)|moliya|(?<!\\p{L})bank(?!\\p{L})|soliq/iu },",
)

replace_once(
    normalize,
    "const SPECIFIC_MANAGER_ROLES = new Set([\n  'Sales Manager', 'Project Manager', 'Product Manager', 'Store Manager', 'Restaurant Manager',\n  'General Manager', 'HR / Recruiter', 'Office Manager', 'Warehouse Manager',\n])\nconst SPECIFIC_DEVELOPER_ROLES = new Set([\n  'Full-stack Developer', 'Backend Developer', 'Frontend Developer', 'Mobile Developer',\n])",
    "const SPECIFIC_MANAGER_ROLES = new Set([\n  'Sales Manager', 'Project Manager', 'Product Manager', 'Store Manager', 'Restaurant Manager',\n  'General Manager', 'HR / Recruiter', 'Office Manager', 'Warehouse Manager', 'Logistics Specialist',\n])\nconst SPECIFIC_DEVELOPER_ROLES = new Set([\n  'Full-stack Developer', 'Backend Developer', 'Frontend Developer', 'Mobile Developer',\n])\nconst SPECIFIC_TECH_ROLES = new Set([\n  'QA Engineer', 'DevOps Engineer', 'Cybersecurity Specialist', 'Penetration Tester',\n  'AI / ML Engineer', 'Data Scientist', 'Data Engineer', 'Hardware Engineer',\n])",
)

replace_once(
    normalize,
    "function cleanRole(raw: string | undefined): string {\n  return (raw || '').trim().replace(/^[#\\-–—•*\\s]+/, '').replace(/[.;,]+$/, '').replace(/\\s{2,}/g, ' ').slice(0, 180)\n}\n",
    "function cleanRole(raw: string | undefined): string {\n  return (raw || '').trim().replace(/^[#\\-–—•*\\s]+/, '').replace(/[.;,]+$/, '').replace(/\\s{2,}/g, ' ').slice(0, 180)\n}\n\nfunction comparableRoleText(raw: string | undefined): string {\n  return cleanRole(raw).toLocaleLowerCase('ru').replace(/[^\\p{L}\\p{N}]+/gu, '')\n}\n",
)

replace_once(
    normalize,
    "  if (names.some((name) => SPECIFIC_DEVELOPER_ROLES.has(name))) {\n    const generic = names.indexOf('Software Developer')\n    if (generic >= 0) names.splice(generic, 1)\n  }",
    "  if (names.some((name) => SPECIFIC_DEVELOPER_ROLES.has(name))) {\n    for (const genericName of ['Software Developer', 'IT Specialist']) {\n      const generic = names.indexOf(genericName)\n      if (generic >= 0) names.splice(generic, 1)\n    }\n  }\n  if (names.some((name) => SPECIFIC_TECH_ROLES.has(name))) {\n    for (const genericName of ['Engineer', 'IT Specialist']) {\n      const generic = names.indexOf(genericName)\n      if (generic >= 0) names.splice(generic, 1)\n    }\n  }",
)

replace_once(
    normalize,
    "  if (names.includes('Dentist')) {\n    const generic = names.indexOf('Doctor')\n    if (generic >= 0) names.splice(generic, 1)\n  }",
    "  if (names.includes('Dentist')) {\n    const generic = names.indexOf('Doctor')\n    if (generic >= 0) names.splice(generic, 1)\n  }\n  if (names.includes('English Teacher')) {\n    const generic = names.indexOf('Teacher')\n    if (generic >= 0) names.splice(generic, 1)\n  }",
)

replace_once(
    normalize,
    "const HIDDEN_NAME_RE = /^(?:фио|піб|name)?\\s*(?:скрыт\\p{L}*|прихован\\p{L}*|hidden|yashiril\\p{L}*|ascuns)$/iu",
    "const HIDDEN_NAME_RE = /^(?:(?:фио|піб|name)?\\s*(?:скрыт\\p{L}*|прихован\\p{L}*|hidden|yashiril\\p{L}*|ascuns)|onlayn|online|resume|резюме|[?？�\\uFFFD]{2,})$/iu",
)

replace_once(
    normalize,
    "const FLEXIBLE_ROLE_RE = /^(?:нет|без)\\s+разницы$|^не\\s*важно$|^farqi\\s+yo['’ʻʼ‘`]?q$|^любая\\s+(?:работа|занятость)$/iu",
    "const FLEXIBLE_ROLE_RE = /^(?:нет|без)\\s+разницы(?:\\s+.*)?$|^не\\s*важно(?:\\s+.*)?$|^farqi\\s+yo['’ʻʼ‘`]?q$|^любая\\s+(?:работа|занятость)(?:\\s+.*)?$/iu",
)

replace_once(
    normalize,
    "const NON_ROLE_RE = /^(?:удал[её]нно|работа\\s+на\\s+удал[её]н\\p{L}*\\s+основе|remote|farqi\\s+yo['’ʻʼ‘`]?q|bilmaym\\p{L}*|ish\\s+ker(?:e|a)\\s+onlayn|любая\\s+(?:работа|занятость)|немає|нет|не\\s+указано|not\\s+specified)$/iu",
    "const NON_ROLE_RE = /^(?:удал[её]нно|работа\\s+на\\s+удал[её]н\\p{L}*\\s+основе|remote|onlayn|online|farqi\\s+yo['’ʻʼ‘`]?q|bilmaym\\p{L}*|ish\\s+ker(?:e|a)\\s+onlayn|любая\\s+(?:работа|занятость)|немає|нет|не\\s+указано|not\\s+specified)$/iu",
)

replace_once(
    normalize,
    "  const rawEffectiveRole = cleanRole(goalRole || sourceRole || profile.role)\n  const flexibleRole = FLEXIBLE_ROLE_RE.test(rawEffectiveRole)\n  const effectiveRole = flexibleRole ? 'General Laborer' : NON_ROLE_RE.test(rawEffectiveRole) ? '' : rawEffectiveRole",
    "  const rawEffectiveRoleCandidate = cleanRole(goalRole || sourceRole || profile.role)\n  const roleDuplicatesName = Boolean(comparableRoleText(rawEffectiveRoleCandidate))\n    && comparableRoleText(rawEffectiveRoleCandidate) === comparableRoleText(profile.name)\n  const rawEffectiveRole = roleDuplicatesName ? '' : rawEffectiveRoleCandidate\n  const flexibleRole = FLEXIBLE_ROLE_RE.test(rawEffectiveRole)\n  const effectiveRole = flexibleRole ? 'Any Role' : NON_ROLE_RE.test(rawEffectiveRole) ? '' : rawEffectiveRole",
)

replace_once(
    normalize,
    "const REMOTE_POSITIVE_RE = /\\bremote\\b|удал[её]н\\p{L}*|віддален|дистанцион|masofaviy|online\\s+(?:work|job)|онлайн\\s+работ/iu",
    "const REMOTE_POSITIVE_RE = /\\bremote\\b|удал[её]н\\p{L}*|віддален|дистанцион|masofaviy|(?<!\\p{L})onlayn(?!\\p{L})|online\\s+(?:work|job)|онлайн\\s+работ/iu",
)

store = Path('server/utils/hiringStore.ts')
replace_once(store, "export const DERIVED_VERSION = 'd17'", "export const DERIVED_VERSION = 'd18'")

tests = Path('tests/regressions.test.mjs')
text = tests.read_text()
marker = "\ntest('hiring technical roles keep industry-standard English labels and Uzbek source roles normalize', () => {"
if marker not in text:
    tests.write_text(text + """

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
    createdAt: '2026-08-22T12:00:00.000Z', originalText: 'Akbar\\nToshkent', description: 'Akbar\\nToshkent',
  })
  assert.equal(duplicateRole.role, '')
  assert.deepEqual(duplicateRole.professions, [])

  const onlineOnly = normalizeCandidate({
    id: 'flagma-online', source: 'telegram', origin: 'web', sourceKey: 'flagma-uz', country: 'UZ',
    name: 'Onlayn', role: 'Onlayn', professions: ['Onlayn'], url: 'https://example.test/online',
    createdAt: '2026-08-22T12:00:00.000Z', originalText: 'Onlayn\\n21 год\\nСырдарья', description: 'Onlayn\\n21 год\\nСырдарья',
  })
  assert.equal(onlineOnly.name, '')
  assert.equal(onlineOnly.role, '')
  assert.deepEqual(onlineOnly.professions, [])
  assert.equal(onlineOnly.remote, true)

  assert.deepEqual(normalizeProfessions('Без разницы я быстро учусь', ''), ['Any Role'])
  assert.equal(hiringProfessionLabel('Any Role', 'ru'), 'Любая работа')
})
""")

# The helper and workflow are one-shot scaffolding; remove them in the same commit
# that applies the actual source changes so the feature branch stays clean.
Path('.github/patches/apply-hiring-localization-normalization.py').unlink(missing_ok=True)
Path('.github/workflows/apply-hiring-localization-normalization.yml').unlink(missing_ok=True)
