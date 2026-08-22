# One-shot patch; the workflow removes this file after applying it.
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'expected block not found in {path}: {old[:160]!r}')
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

tests = Path('tests/hiringProfessionLabels.test.mjs')
replace_once(
    tests,
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'ru'), 'Преподаватель')",
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'ru'), 'Преподаватель английского')",
)
replace_once(
    tests,
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'en'), 'Teacher')",
    "  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'en'), 'English Teacher')",
)

regressions = Path('tests/regressions.test.mjs')
replace_once(
    regressions,
    "  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Специалист по тестированию на проникновение')",
    "  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Pentester')",
)

Path('.github/patches/fix-hiring-display-labels.py').unlink(missing_ok=True)
Path('.github/workflows/fix-hiring-display-labels.yml').unlink(missing_ok=True)
