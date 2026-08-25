from pathlib import Path
import re

path = Path('server/utils/hiringNormalize.ts')
text = path.read_text()

IMPORT_ANCHOR = "import { parseSalary as parseWebSalary } from './hiringWebFields'\n"
SHARED_IMPORT = """import {
  detectProfessionMatches,
  detectSharedSeniority,
  resolveSharedProfessionContext,
} from './hiringLexicon'\n"""
if SHARED_IMPORT not in text:
    if IMPORT_ANCHOR not in text:
        raise SystemExit('hiringNormalize import anchor not found')
    text = text.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + SHARED_IMPORT, 1)

old_seniority = """const B = '(?<![\\\\p{L}\\\\p{N}])'
const E = '(?![\\\\p{L}\\\\p{N}])'
const rule = (body: string) => new RegExp(`${B}(?:${body})${E}`, 'iu')

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ['lead', rule(\"tech\\\\s*lead|team\\\\s*lead|teamlead|tim\\\\s*lid|lead|head\\\\s+of|руководител\\\\p{L}*|тимлид\\\\p{L}*|лид\")],
  ['senior', rule('senior|sr\\\\.?|синьор\\\\p{L}*|сеньор\\\\p{L}*|ведущий|старший')],
  ['middle', rule('middle|mid-?level|mid|мидл\\\\p{L}*|миддл\\\\p{L}*|средний\\\\s+уровень')],
  ['junior', rule('junior|jr\\\\.?|джуниор\\\\p{L}*|джун|младший|trainee|intern(?:ship)?|стажер|стажёр|начинающий')],
]

const JUNIOR_CONTRADICTION_YEARS = 4

export function detectSeniority(text: string, experienceYears?: number | null): Seniority | null {
  for (const [level, re] of SENIORITY_RULES) {
    if (!re.test(text)) continue
    if (level === 'junior' && (experienceYears ?? 0) >= JUNIOR_CONTRADICTION_YEARS) break
    return level
  }
  if (experienceYears == null) return null
  if (experienceYears >= 6) return 'senior'
  if (experienceYears >= 3) return 'middle'
  if (experienceYears >= 1) return 'junior'
  return null
}
"""
new_seniority = """const JUNIOR_CONTRADICTION_YEARS = 4

export function detectSeniority(text: string, experienceYears?: number | null): Seniority | null {
  const shared = detectSharedSeniority(text) as Seniority | null
  if (shared) {
    // Explicit staff/principal/lead/head/director/vp/chief must never collapse to senior.
    if ((shared === 'intern' || shared === 'junior') && (experienceYears ?? 0) >= JUNIOR_CONTRADICTION_YEARS) {
      return (experienceYears ?? 0) >= 6 ? 'senior' : 'middle'
    }
    return shared
  }
  if (experienceYears == null) return null
  if (experienceYears >= 6) return 'senior'
  if (experienceYears >= 3) return 'middle'
  if (experienceYears >= 1) return 'junior'
  return null
}
"""
if old_seniority in text:
    text = text.replace(old_seniority, new_seniority, 1)
elif 'const SENIORITY_RULES' in text:
    raise SystemExit('seniority block changed unexpectedly')

profession_start = text.find('interface ProfessionRule')
profession_end = text.find('const NON_TARGET_CONTEXT_RE')
if profession_start < 0 or profession_end < 0 or profession_end <= profession_start:
    raise SystemExit('profession block anchors not found')

profession_replacement = """const PROFESSION_ACRONYMS = new Map<string, string>([
  ['qa', 'QA'], ['hr', 'HR'], ['ui', 'UI'], ['ux', 'UX'], ['ai', 'AI'], ['ml', 'ML'],
  ['seo', 'SEO'], ['sre', 'SRE'], ['dba', 'DBA'], ['crm', 'CRM'], ['erp', 'ERP'], ['pmo', 'PMO'],
])

function formatProfessionCanonical(canonical: string): string {
  return canonical.split('_').map((part) =>
    PROFESSION_ACRONYMS.get(part) || `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
  ).join(' ')
}

function collectProfessions(source: string): string[] {
  return [...new Set(
    detectProfessionMatches(source, 16).map((match) => formatProfessionCanonical(match.canonical)),
  )]
}

"""
text = text[:profession_start] + profession_replacement + text[profession_end:]

# Prefer the package's section-aware candidate profession resolver for the final desired-role decision.
old_normalize = re.compile(r"export function normalizeProfessions\(rawRole: string \| undefined, text: string\): string\[\] \{.*?\n\}\n\nexport function normalizeRole", re.S)
match = old_normalize.search(text)
if not match:
    raise SystemExit('normalizeProfessions block not found')
new_normalize = """export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {
  const target = cleanRole(rawRole)
  if (FLEXIBLE_ROLE_RE.test(target)) return ['Any Role']
  if (NON_ROLE_RE.test(target)) return []

  const resolved = resolveSharedProfessionContext(text, { mode: 'candidate', title: target }) as {
    desiredProfession?: { canonical?: string } | null
    mentionedProfessions?: Array<{ canonical?: string }>
  }
  const desired = resolved.desiredProfession?.canonical
  if (desired) return [formatProfessionCanonical(desired)]

  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {
    const targetMatches = collectProfessions(target)
    if (targetMatches.length) return targetMatches
  }

  const contextualMatches = collectProfessions(targetContext(text))
  if (contextualMatches.length) return contextualMatches
  return target && !NON_TARGET_CONTEXT_RE.test(target) ? [target] : []
}

export function normalizeRole"""
text = text[:match.start()] + new_normalize + text[match.end():]

path.write_text(text)
