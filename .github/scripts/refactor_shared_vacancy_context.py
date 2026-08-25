from pathlib import Path
import re

contracts = Path('shared/contracts/jobs.ts')
text = contracts.read_text()
text = text.replace(
    "export interface LanguageReq {\n  language: string\n  level?: string\n}\n",
    "export interface LanguageReq {\n  language: string\n  level?: string\n  requirement?: 'required' | 'preferred' | 'notRequired'\n}\n",
    1,
)
needle = "  applicationLanguage?: string\n"
extra = """  applicationLanguage?: string
  hiringKind?: 'vacancy' | 'candidate' | 'vacancy_digest' | 'recruitment_ad' | 'course' | 'job_service' | 'closed_vacancy' | 'spam' | 'unknown'
  vacancyStatus?: string
  workAuthorization?: string[]
  travelRequirement?: string
  benefits?: string[]
  applicationRequirements?: string[]
  openingCount?: number
"""
if needle in text and 'hiringKind?:' not in text:
    text = text.replace(needle, extra, 1)
contracts.write_text(text)

enrich = Path('server/utils/enrich.ts')
text = enrich.read_text()
text = text.replace(
    "import { parseHiringSalary } from './hiringLexicon'",
    """import {
  detectEmploymentTypes,
  detectExperienceRequirement,
  detectProbation,
  detectSharedSeniority,
  detectWorkModes,
  detectWorkSchedules,
  parseHiringExperience,
  parseHiringSalary,
  parseSharedHiringContext,
  parseSharedLanguageContext,
} from './hiringLexicon'""",
    1,
)

# Replace work mode / relocation / authorization / experience / employment / seniority with shared semantic wrappers.
start = text.find('// ---- Work mode ----')
end = text.find('function detectManagementRole', start)
if start < 0 or end < 0:
    raise SystemExit('shared vacancy context replacement anchors missing')
replacement = r'''// ---- Shared vacancy context ----
function detectWorkMode(text: string, job: Job): WorkMode {
  const modes = detectWorkModes(text)
  if (modes.includes('hybrid')) return 'hybrid'
  if (modes.includes('remote') || job.remote) return 'remote'
  if (modes.includes('onsite')) return 'office'
  return 'unknown'
}

function sharedHiringContext(text: string, title: string) {
  return parseSharedHiringContext(text, { mode: 'vacancy', title }) as {
    kind: Job['hiringKind']
    relocation: 'offered' | 'required' | 'notOffered' | null
    workAuthorization: string[]
    travel: string | null
    benefits: string[]
    application: string[]
    openingCount: number | null
    vacancyStatus: string | null
    educationContext: string | null
    contracts: string[]
  }
}

function detectRelocation(context: ReturnType<typeof sharedHiringContext>): Relocation {
  if (context.relocation === 'offered') return 'offered'
  if (context.relocation === 'notOffered') return 'none'
  return 'unknown'
}

function detectForeignerFriendly(context: ReturnType<typeof sharedHiringContext>): boolean | undefined {
  if (context.workAuthorization.includes('sponsorshipOffered')) return true
  if (context.workAuthorization.some((item) => ['noSponsorship', 'workPermitRequired', 'citizenshipRequired'].includes(item))) return false
  return undefined
}

function detectNoExperience(text: string): boolean {
  return detectExperienceRequirement(text) === 'noExperience'
}

function detectExperienceYears(text: string): { min?: number, max?: number } {
  const parsed = parseHiringExperience(text)
  return {
    min: parsed?.minYears ?? undefined,
    max: parsed?.maxYears ?? undefined,
  }
}

function detectEmploymentKind(job: Job, text: string): EmploymentKind | undefined {
  const detected = detectEmploymentTypes(`${job.employmentType || ''} ${text}`)[0]
  const map: Record<string, EmploymentKind> = {
    full_time: 'fulltime',
    part_time: 'parttime',
    contract: 'contract',
    project: 'project',
    freelance: 'freelance',
    internship: 'internship',
    temporary: 'temporary',
    volunteer: 'volunteer',
    seasonal: 'seasonal',
  }
  return detected ? map[detected] : undefined
}

function detectSeniority(title: string, text: string): Seniority | null {
  return detectSharedSeniority(`${title}\n${text}`) as Seniority | null
}

'''
text = text[:start] + replacement + text[end:]

# Salary modifiers are already provided by shared money parser.
start = text.find('function detectSalaryGross')
end = text.find('function detectSchedule', start)
if start < 0 or end < 0:
    raise SystemExit('salary modifier block anchors missing')
replacement = r'''function detectSalaryGross(text: string): boolean | undefined {
  return parseHiringSalary(text)?.gross ?? undefined
}

function detectSalaryNegotiable(text: string): boolean | undefined {
  return parseHiringSalary(text)?.negotiable || undefined
}

'''
text = text[:start] + replacement + text[end:]

# Schedule uses shared canonical schedule semantics, retaining the legacy display field.
start = text.find('function detectSchedule')
end = text.find('function detectContractType', start)
if start < 0 or end < 0:
    raise SystemExit('schedule block anchors missing')
replacement = r'''function detectSchedule(text: string): string | undefined {
  const schedule = detectWorkSchedules(text)[0]
  const labels: Record<string, string> = {
    fiveTwo: '5/2', twoTwo: '2/2', sixOne: '6/1', threeThree: '3/3', oneThree: '1/3',
    twentyFourFortyEight: '24/48', shift: 'Shift work', flexible: 'Flexible', day: 'Day',
    night: 'Night', rotational: 'Rotational',
  }
  return schedule ? labels[schedule] || schedule : undefined
}

'''
text = text[:start] + replacement + text[end:]

# Contracts/education use shared context first; source-specific display remains fallback-compatible.
old_contract = re.compile(r"function detectContractType\(text: string\): string \| undefined \{.*?\n\}\n\nfunction detectEducation", re.S)
m = old_contract.search(text)
if not m:
    raise SystemExit('contract block missing')
new_contract = r'''function detectContractType(text: string, context?: ReturnType<typeof sharedHiringContext>): string | undefined {
  const contract = context?.contracts?.[0]
  const labels: Record<string, string> = {
    employmentContract: 'Employment contract', civilContract: 'Civil contract',
    freelance: 'Freelance', contractor: 'Contractor', b2b: 'B2B',
  }
  if (contract) return labels[contract] || contract
  if (/\bB2B\b/i.test(text)) return 'B2B'
  return undefined
}

function detectEducation'''
text = text[:m.start()] + new_contract + text[m.end():]

# Remove local language catalog/level parser and replace it with contextual shared languages.
start = text.find('// ---- Languages + levels ----')
end = text.find('// Most skills use literal Unicode-aware aliases', start)
if start < 0 or end < 0:
    raise SystemExit('language block anchors missing')
replacement = r'''// ---- Languages + contextual requirement relation ----
function detectLanguages(text: string): LanguageReq[] {
  return (parseSharedLanguageContext(text, 'vacancy') as Array<{
    name: string
    relation: 'required' | 'preferred' | 'notRequired' | 'candidateHas' | null
    level: string | null
    cefr: string | null
  }>).map((item) => ({
    language: item.name,
    level: item.cefr || item.level || undefined,
    requirement: item.relation && item.relation !== 'candidateHas' ? item.relation : undefined,
  }))
}

'''
text = text[:start] + replacement + text[end:]

# Enrichment now computes one shared context object once and exposes its structured fields.
needle = "  const text = `${title} \\n ${job.tags.join(' ')} \\n ${description}`\n"
if needle not in text:
    raise SystemExit('enrich text anchor missing')
text = text.replace(needle, needle + "  const hiringContext = sharedHiringContext(text, title)\n", 1)
text = text.replace('    relocation: detectRelocation(text),', '    relocation: detectRelocation(hiringContext),', 1)
text = text.replace('    foreignerFriendly: detectForeignerFriendly(text),', '    foreignerFriendly: detectForeignerFriendly(hiringContext),', 1)
text = text.replace('    contractType: detectContractType(text),', '    contractType: detectContractType(text, hiringContext),', 1)
text = text.replace('    education: detectEducation(text),', '    education: hiringContext.educationContext || detectEducation(text),', 1)
text = text.replace(
    '    schedule: detectSchedule(text),',
    "    schedule: detectSchedule(text),\n    workSchedules: detectWorkSchedules(text),\n    probationKind: detectProbation(text),\n    experienceRequirement: detectExperienceRequirement(text),",
    1,
)
text = text.replace(
    '    applicationLanguage: detectApplicationLanguage(text),',
    "    applicationLanguage: detectApplicationLanguage(text),\n    hiringKind: hiringContext.kind,\n    vacancyStatus: hiringContext.vacancyStatus || undefined,\n    workAuthorization: hiringContext.workAuthorization,\n    travelRequirement: hiringContext.travel || undefined,\n    benefits: hiringContext.benefits,\n    applicationRequirements: hiringContext.application,\n    openingCount: hiringContext.openingCount ?? undefined,",
    1,
)

stale = [
    'const LANGUAGES:', 'function normalizeLevel(',
    'no experience (required|needed|necessary)',
    'visa sponsor|visa support|will sponsor',
    "const leadPattern = isTitle",
]
for token in stale:
    if token in text:
        raise SystemExit(f'stale vacancy lexicon remains: {token}')

enrich.write_text(text)
