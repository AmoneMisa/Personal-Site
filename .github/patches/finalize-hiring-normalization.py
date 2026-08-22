from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'expected block not found in {path}: {old[:140]!r}')
    path.write_text(text.replace(old, new, 1))

normalize = Path('server/utils/hiringNormalize.ts')
replace_once(
    normalize,
    "export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {\n  // Desired-role text wins, except when a loose source parser handed us an\n  // explicit work-history/education line instead of a target role.\n  const target = cleanRole(rawRole)\n  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {",
    "export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {\n  // Desired-role text wins, except when a loose source parser handed us an\n  // explicit work-history/education line instead of a target role.\n  const target = cleanRole(rawRole)\n  if (FLEXIBLE_ROLE_RE.test(target)) return ['Any Role']\n  if (NON_ROLE_RE.test(target)) return []\n  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {",
)

tests = Path('tests/regressions.test.mjs')
replace_once(
    tests,
    "test('a candidate who accepts any work is classified as a general laborer', () => {",
    "test('a candidate who accepts any work keeps an explicit any-role preference', () => {",
)
replace_once(
    tests,
    "    assert.equal(profile.role, 'General Laborer')\n    assert.deepEqual(profile.professions, ['General Laborer'])",
    "    assert.equal(profile.role, 'Any Role')\n    assert.deepEqual(profile.professions, ['Any Role'])",
)

Path('.github/patches/finalize-hiring-normalization.py').unlink(missing_ok=True)
Path('.github/workflows/finalize-hiring-normalization.yml').unlink(missing_ok=True)
