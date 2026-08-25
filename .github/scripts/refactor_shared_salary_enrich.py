from pathlib import Path

path = Path('server/utils/enrich.ts')
text = path.read_text()

anchor = "import { toUsd } from './currency'\n"
shared = "import { parseHiringSalary } from './hiringLexicon'\n"
if shared not in text:
    if anchor not in text:
        raise SystemExit('currency import anchor missing')
    text = text.replace(anchor, anchor + shared, 1)

text = text.replace(
    'export const PER_YEAR: Record<SalaryPeriod, number> = {',
    'export const PER_YEAR: Partial<Record<SalaryPeriod, number>> = {',
    1,
)

start = text.find('const SALARY_CONTEXT_RE =')
end = text.find('// Sources that quote monthly salaries by convention', start)
if start < 0 or end < 0:
    raise SystemExit('salary parser block anchors missing')

replacement = """function explicitSalaryPeriod(text: string): SalaryPeriod | undefined {
  return parseHiringSalary(text)?.period || undefined
}

/** Infer a salary range from free text using the shared multilingual money parser. */
export function extractSalaryFromText(raw: string | undefined): ExtractedSalary {
  if (!raw) return {}
  const parsed = parseHiringSalary(cleanText(raw))
  if (!parsed || (parsed.min == null && parsed.max == null)) return {}
  return {
    salaryMin: parsed.min ?? undefined,
    salaryMax: parsed.max ?? undefined,
    salaryCurrency: parsed.currency ?? undefined,
    salaryPeriod: parsed.period ?? undefined,
  }
}

"""
text = text[:start] + replacement + text[end:]

old = """  const mid = lo && hi ? (lo + hi) / 2 : lo || hi
  if (!mid) return undefined
  return Math.round(mid * PER_YEAR[period])
}"""
new = """  const mid = lo && hi ? (lo + hi) / 2 : lo || hi
  const factor = PER_YEAR[period]
  if (!mid || !factor) return undefined
  return Math.round(mid * factor)
}"""
if old not in text:
    raise SystemExit('salaryUsd body anchor missing')
text = text.replace(old, new, 1)

for stale in ['SALARY_CONTEXT_RE', 'MONEY_RE', 'function salaryCurrency(', 'function salaryAmount(']:
    if stale in text:
        raise SystemExit(f'stale local salary lexicon remains: {stale}')

path.write_text(text)
