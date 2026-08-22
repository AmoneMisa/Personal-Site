# One-shot patch; removed after successful application.
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'expected block not found in {path}: {old[:180]!r}')
    path.write_text(text.replace(old, new, 1))

labels = Path('shared/hiringProfessionLabels.ts')
replace_once(
    labels,
    "  'Frontend Developer': { en: 'Frontend Developer', ru: 'Frontend-разработчик' },",
    "  'Frontend Developer': { en: 'Frontend Developer', ru: 'Frontend Developer' },",
)
replace_once(
    labels,
    "export function hiringProfessionLabel(value: string, locale: HiringProfessionLocale): string {\n  const key = String(value || '').trim()\n  return HIRING_PROFESSION_LABELS[key]?.[locale] || key\n}\n",
    "const RAW_PROFESSION_LABELS: Array<{ re: RegExp; key?: string; en?: string; ru?: string }> = [\n  { re: /^iqt(?:i)?sodchi$/iu, key: 'Economist' },\n  { re: /^iqtisodiy$/iu, key: 'Economist' },\n  { re: /^logist$/iu, key: 'Logistics Specialist' },\n  { re: /^ingliz\\s+tili\\s+ustoz(?:iman)?$/iu, key: 'English Teacher' },\n  { re: /mobilagraf[\\s\\S]*itishnik[\\s\\S]*front(?:et|ent|end)/iu, key: 'Frontend Developer' },\n  { re: /farqi\\s+yo[\\s\\S]*bolalarga\\s+qarash/iu, key: 'Nanny' },\n  { re: /^(?:sales\\s+executive(?:\\s+ind)?|роп(?:,?\\s*sales\\s+executive)?)$/iu, key: 'Sales Manager' },\n  { re: /^onlayn$/iu, en: 'Remote work', ru: 'Удалённая работа' },\n]\n\nexport function hiringProfessionLabel(value: string, locale: HiringProfessionLocale): string {\n  const key = String(value || '').trim()\n  const canonical = HIRING_PROFESSION_LABELS[key]\n  if (canonical) return canonical[locale]\n\n  for (const alias of RAW_PROFESSION_LABELS) {\n    if (!alias.re.test(key)) continue\n    if (alias.key) return HIRING_PROFESSION_LABELS[alias.key]?.[locale] || alias.key\n    return alias[locale] || key\n  }\n  return key\n}\n",
)

normalize = Path('server/utils/hiringNormalize.ts')
replace_once(
    normalize,
    "export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {\n  // Desired-role text wins, except when a loose source parser handed us an\n  // explicit work-history/education line instead of a target role.\n  const target = cleanRole(rawRole)\n  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {",
    "export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {\n  // Desired-role text wins, except when a loose source parser handed us an\n  // explicit work-history/education line instead of a target role.\n  const target = cleanRole(rawRole)\n  if (FLEXIBLE_ROLE_RE.test(target)) return ['Any Role']\n  if (NON_ROLE_RE.test(target)) return []\n  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {",
)

profession_tests = Path('tests/hiringProfessionLabels.test.mjs')
replace_once(
    profession_tests,
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'ru'), 'Преподаватель')",
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'ru'), 'Преподаватель английского')",
)
replace_once(
    profession_tests,
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'en'), 'Teacher')",
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'en'), 'English Teacher')",
)

regressions = Path('tests/regressions.test.mjs')
replace_once(
    regressions,
    "  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Специалист по тестированию на проникновение')",
    "  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Pentester')",
)
replace_once(
    regressions,
    "test('a candidate who accepts any work is classified as a general laborer', () => {",
    "test('a candidate who accepts any work keeps an explicit any-role preference', () => {",
)
replace_once(
    regressions,
    "    assert.equal(profile.role, 'General Laborer')\n    assert.deepEqual(profile.professions, ['General Laborer'])",
    "    assert.equal(profile.role, 'Any Role')\n    assert.deepEqual(profile.professions, ['Any Role'])",
)

Path('.github/patches/finalize-hiring-localization-v2.py').unlink(missing_ok=True)
Path('.github/workflows/finalize-hiring-localization-v2.yml').unlink(missing_ok=True)
