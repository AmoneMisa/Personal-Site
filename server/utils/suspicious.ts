// Vacancy risk + vagueness classification.
//
// Two separate outputs, deliberately:
//
//   riskCategory  — a HARD-BLOCKED industry (gambling / adult / scam). The Job
//                   Finder hides these by default. Because hiding is silent, the
//                   rules here must be specific: every match records a reason so
//                   the decision is auditable, and ambiguous words never block on
//                   their own (see the WEAK tiers below).
//   suspicious    — a SOFT warning ("this posting never says what you'd do").
//                   Shown as a badge; it never removes the vacancy by itself.
//
// Guard rails against false positives on legitimate jobs:
//   * "gaming"/"game developer" is game development, NOT gambling — only
//     iGaming/casino/betting vocabulary blocks.
//   * "streamer", "web model", "chat operator", "support" are legitimate roles;
//     they only count as adult recruitment together with an explicit adult signal.
//   * A plain office job with real duties is never blocked: the scam category
//     needs earnings-bait markers, not merely "office" + "no experience".

export type RiskCategory = 'gambling' | 'adult' | 'scam'

export interface SuspicionResult {
  riskCategory: RiskCategory | null
  riskReasons: string[]
  suspicious: boolean
  suspicionReasons: string[]
}

// ---- Hard-blocked: gambling / iGaming -------------------------------------
// Deliberately excludes the bare word "gaming" (game studios are legitimate).
const GAMBLING = [
  ['casino', /\bcasino\b|казино|казіно|kazino/i],
  ['gambling', /\bgambling\b|азартн(?:ые|ых|ой|і)\s*игр|азартні\s*ігри|qimor/i],
  ['betting', /\bbetting\b|\bbookmaker\b|букмекер|беттинг|ставк[аи]\s+на\s+спорт|тотализатор/i],
  ['igaming', /\bi-?gaming\b|\bslots?\s+(?:provider|studio|game)|\bpoker\s+(?:room|club|operator)/i],
  ['betting-brand', /\b(?:1xbet|melbet|parimatch|betwinner|pin-?up|mostbet|1win)\b/i],
] as const

// ---- Hard-blocked: adult / OnlyFans-adjacent ------------------------------
// STRONG terms are unambiguous on their own.
const ADULT_STRONG = [
  ['onlyfans', /\bonly\s?fans\b|\bof-?модел|onlyfans-?модел/i],
  ['webcam', /\bweb\s?cam\s?(?:model|studio)|вебкам|веб-?кам|webcam-?модел/i],
  ['adult-content', /\badult\s+(?:content|industry|video|site)|порно|эротич|еротич|интим(?:н|ные услуги)|інтим/i],
  ['escort', /\bescort\b|эскорт|ескорт/i],
]
// WEAK terms are legitimate roles in most contexts; they only block when an
// explicit adult signal appears alongside them.
const ADULT_WEAK = /\bweb\s?model\b|веб-?модел|стример(?:ша|ов)?|стрімер|чат-?оператор|chat\s+operator|оператор\s+чат/i
const ADULT_SIGNAL = /18\+|только\s+девушк|лише\s+дівчат|откровенн|відверт|приватн(?:ые|ый)\s+(?:шоу|чат)|интимн|adult|пикантн|без\s+интима|для\s+девушек\s+от\s+18/i

// ---- Hard-blocked: earnings-bait / scam recruitment -----------------------
// These target the "no duties, just money" pattern used by scam call centres and
// MLM. A normal office vacancy that states duties will not match.
const SCAM = [
  ['easy-money', /лёгк(?:ий|ие)\s+(?:заработок|деньги)|легк(?:ий|ие)\s+(?:заработок|деньги)|быстр(?:ый|ые)\s+(?:заработок|деньги)|easy\s+money|швидк(?:ий|і)\s+заробіт/i],
  ['daily-payout', /выплаты\s+(?:ежедневно|каждый\s+день)|ежедневн(?:ые|ая)\s+выплат|оплата\s+каждый\s+день|щоденн[іа]\s+виплат/i],
  ['guaranteed-income', /гарантированн(?:ый|ого)\s+доход|гарантований\s+дохід|guaranteed\s+income|доход\s+от\s+\d[\d\s]{2,}\s*(?:\$|usd|у\.?е\.?)\s*в\s*(?:день|неделю)/i],
  ['no-investment', /без\s+вложений|без\s+вкладень|no\s+investment\s+required/i],
  ['mlm', /сетев(?:ой|ого)\s+маркетинг|\bmlm\b|млм|финансов(?:ая|ой)\s+независимост|пассивн(?:ый|ого)\s+доход/i],
  ['crypto-bait', /гарантированн\w*\s+(?:прибыл|профит)|трейдинг\s+с\s+гарант|инвестиц\w*\s+с\s+гарант/i],
]

// ---- Soft signals: the posting never says what you'd actually do ----------
const HAS_DUTIES = /обязанност|обов'?язк|responsibilit|what\s+you(?:'|’)?ll\s+(?:do|be\s+doing)|задачи|завдання|duties|your\s+role|чем\s+предстоит\s+заниматься|функционал|job\s+description|требования\s+к\s+задачам/i
const HAS_PRODUCT = /продукт|product|платформ|сервис|сервіс|service|приложени|застосунок|\bapp\b|систем|клиентам\s+(?:банка|компании)|индустри|industry|проект|project/i
const VAGUE_TITLE = /^(?:менеджер|специалист|спеціаліст|сотрудник|співробітник|оператор|консультант|помощник|помічник|ассистент|manager|specialist|operator|assistant|consultant|employee|staff)$/i
const GENERIC_DUTY = /общение\s+с\s+клиентами|спілкування\s+з\s+клієнтами|работа\s+с\s+клиентами|communication\s+with\s+clients|прием\s+звонков|ответы\s+на\s+сообщения/i
const EARNINGS_FOCUS = /(?:доход|заработок|заработная\s+плата|зарплата|дохід|заробіток|earnings|income)/gi
const WORK_WORDS = /(?:задач|обязанн|проект|разработ|клиент|продукт|команд|опыт|навык|обов|розроб|досвід|навич|task|project|develop|team|skill|experience)/gi

function testAll(rules: readonly (readonly [string, RegExp])[] | [string, RegExp][], text: string): string[] {
  const hits: string[] = []
  for (const [name, re] of rules) if (re.test(text)) hits.push(name)
  return hits
}

/**
 * Classify a vacancy. `title`/`company`/`description` are raw text; everything is
 * matched case-insensitively across the combined text.
 */
export function classifySuspicion(input: {
  title?: string
  company?: string
  description?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
}): SuspicionResult {
  const title = (input.title || '').trim()
  const description = (input.description || '').trim()
  const text = `${title}\n${input.company || ''}\n${description}`

  // --- hard-blocked categories ---
  const riskReasons: string[] = []
  let riskCategory: RiskCategory | null = null

  const gambling = testAll(GAMBLING, text)
  if (gambling.length) {
    riskCategory = 'gambling'
    riskReasons.push(...gambling.map((r) => `gambling:${r}`))
  }

  const adultStrong = testAll(ADULT_STRONG as [string, RegExp][], text)
  const adultWeak = ADULT_WEAK.test(text) && ADULT_SIGNAL.test(text)
  if (adultStrong.length || adultWeak) {
    riskCategory = riskCategory || 'adult'
    riskReasons.push(...adultStrong.map((r) => `adult:${r}`))
    if (adultWeak) riskReasons.push('adult:role+explicit-signal')
  }

  const scam = testAll(SCAM as [string, RegExp][], text)
  if (scam.length) {
    riskCategory = riskCategory || 'scam'
    riskReasons.push(...scam.map((r) => `scam:${r}`))
  }

  // --- soft "vague posting" signals ---
  const suspicionReasons: string[] = []
  const hasDuties = HAS_DUTIES.test(text)
  const longEnough = description.length >= 200

  if (!hasDuties && description.length < 400) suspicionReasons.push('no-responsibilities')
  if (VAGUE_TITLE.test(title)) suspicionReasons.push('vague-title')
  if (!hasDuties && GENERIC_DUTY.test(text)) suspicionReasons.push('generic-duties')
  if (!input.company || /^(?:компания|company|фирма|организация|работодатель|employer)$/i.test(input.company.trim())) {
    suspicionReasons.push('unclear-employer')
  }
  if (longEnough && !HAS_PRODUCT.test(text)) suspicionReasons.push('no-product-description')

  // Earnings mentioned far more than the work itself.
  const earnings = (text.match(EARNINGS_FOCUS) || []).length
  const work = (text.match(WORK_WORDS) || []).length
  if (earnings >= 3 && earnings > work) suspicionReasons.push('earnings-focused')

  // A high salary with no stated duties is the classic bait shape. Currency-aware
  // so a large nominal amount in a soft currency is not treated as "high".
  const HIGH: Record<string, number> = { USD: 5000, EUR: 5000, GBP: 4000, PLN: 20000, UAH: 120000, KZT: 1500000, UZS: 40000000, RUB: 400000 }
  const cap = HIGH[String(input.salaryCurrency || '').toUpperCase()]
  const top = input.salaryMax ?? input.salaryMin
  if (cap && top && top >= cap && !hasDuties) suspicionReasons.push('high-salary-no-duties')

  return {
    riskCategory,
    riskReasons,
    // Two independent weak signals, or any hard-block, make it worth warning about.
    suspicious: suspicionReasons.length >= 2 || riskCategory !== null,
    suspicionReasons,
  }
}
