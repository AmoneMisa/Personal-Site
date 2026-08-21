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
//   * Telegram/Facebook/WhatsApp and screenshot mentions are harmless by
//     themselves; spam/microtask recruitment blocks only on a paid-action pattern.
//   * Crypto/blockchain jobs are not blocked merely for mentioning crypto. The
//     vague-crypto rule requires vague operational duties plus beginner/training
//     bait and either Telegram recruitment or implausibly high beginner pay.

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
const ADULT_WEAK = /\bweb\s?model\b|веб-?модел|стример(?:ша|ов)?|стрімер|чат-?оператор|chat\s+operator|оператор\s+чат/i
const ADULT_SIGNAL = /18\+|только\s+девушк|лише\s+дівчат|откровенн|відверт|приватн(?:ые|ый)\s+(?:шоу|чат)|интимн|adult|пикантн|без\s+интима|для\s+девушек\s+от\s+18/i

// ---- Hard-blocked: earnings-bait / scam recruitment -----------------------
const SCAM = [
  ['easy-money', /лёгк(?:ий|ие)\s+(?:заработок|деньги)|легк(?:ий|ие)\s+(?:заработок|деньги)|быстр(?:ый|ые)\s+(?:заработок|деньги)|easy\s+money|швидк(?:ий|і)\s+заробіт/i],
  ['daily-payout', /выплаты\s+(?:ежедневно|каждый\s+день)|ежедневн(?:ые|ая)\s+выплат|оплата\s+каждый\s+день|щоденн[іа]\s+виплат/i],
  ['guaranteed-income', /гарантированн(?:ый|ого)\s+доход|гарантований\s+дохід|guaranteed\s+income|доход\s+от\s+\d[\d\s]{2,}\s*(?:\$|usd|у\.?е\.?)\s*в\s*(?:день|неделю)/i],
  ['no-investment', /без\s+вложений|без\s+вкладень|no\s+investment\s+required/i],
  ['mlm', /сетев(?:ой|ого)\s+(?:маркетинг|бизнес)|\bmlm\b|млм|финансов(?:ая|ой)\s+независимост|пассивн(?:ый|ого)\s+доход/i],
  ['crypto-bait', /гарантированн[а-яёіїєґ]*\s+(?:прибыл|профит)|трейдинг\s+с\s+гарант|инвестиц[а-яёіїєґ]*\s+с\s+гарант/i],
]

// Known scam recruiter/contact identifiers gathered from reviewed vacancy samples.
const SCAM_CONTACTS = [
  ['telegram:valery_hr_36', /(?:^|[^a-z0-9_])@?valery_hr_36(?:$|[^a-z0-9_])/i],
  ['telegram:kris_mogelevich7', /(?:^|[^a-z0-9_])@?kris_mogelevich7(?:$|[^a-z0-9_])/i],
  ['telegram:gasgazz_07', /(?:^|[^a-z0-9_])@?gasgazz_07(?:$|[^a-z0-9_])/i],
  ['phone:+998992993435', /(?:\+?998[\s()\-]*)99[\s()\-]*299[\s()\-]*34[\s()\-]*35/],
  ['phone:+998992600344', /(?:\+?998[\s()\-]*)99[\s()\-]*260[\s()\-]*03[\s()\-]*44/],
  ['phone:+998931244802', /(?:\+?998[\s()\-]*)93[\s()\-]*124[\s()\-]*48[\s()\-]*02/],
] as const

// User-reported Telegram blacklist from Moshelovka/ONF. These matches are kept
// strict: only an @handle or t.me link triggers, never a bare ordinary word.
// Source: https://moshelovka.onf.ru/blacklist_site/tg-kanaly-moshennikov/
const REPORTED_SCAM_TELEGRAM = [
  ['moshelovka:pitupishka', /(?:@pitupishka\b|t\.me\/pitupishka\b)/i],
  ['moshelovka:obnalmanua1', /(?:@obnalmanua1\b|t\.me\/obnalmanua1\b)/i],
  ['moshelovka:p2p_lab_processing', /(?:@p2p_lab_processing\b|t\.me\/p2p_lab_processing\b)/i],
  ['moshelovka:hoodmoneyp2p', /(?:@hoodmoneyp2p\b|t\.me\/hoodmoneyp2p\b)/i],
  ['moshelovka:p2prvt', /(?:@p2prvt\b|t\.me\/p2prvt\b)/i],
  ['moshelovka:invite-hqnj', /t\.me\/\+-HQNjKgsgHA2ZWM0/i],
  ['moshelovka:protsessing', /(?:@protsessing\b|t\.me\/protsessing\b)/i],
  ['moshelovka:protsessing0', /(?:@protsessing0\b|t\.me\/protsessing0\b)/i],
  ['moshelovka:dropovod01k_chat', /(?:@dropovod01k_chat\b|t\.me\/dropovod01k_chat\b)/i],
  ['moshelovka:invite-adhp', /t\.me\/\+adhPBvVJDdk2NjFi/i],
  ['moshelovka:processing_skupka', /(?:@processing_skupka\b|t\.me\/processing_skupka\b)/i],
  ['moshelovka:mamonts', /(?:@mamonts\b|t\.me\/mamonts\b)/i],
  ['moshelovka:brown_bear0', /(?:@brown_bear0\b|t\.me\/brown_bear0\b)/i],
  ['moshelovka:mediap2p', /(?:@mediap2p\b|t\.me\/mediap2p\b)/i],
  ['moshelovka:proseccina', /(?:@proseccina\b|t\.me\/proseccina\b)/i],
  ['moshelovka:amanatniy', /(?:@amanatniy\b|t\.me\/amanatniy\b)/i],
  ['moshelovka:pitupitradersrf', /(?:@pitupitradersrf\b|t\.me\/pitupitradersrf\b)/i],
  ['moshelovka:russiantradersclubs', /(?:@russiantradersclubs\b|t\.me\/russiantradersclubs\b)/i],
  ['moshelovka:vvaybit', /(?:@vvaybit\b|t\.me\/vvaybit\b)/i],
] as const

const DATING_AGENCY = /брачн(?:ое|ого|ом|ые|ых)\s+агентств|агентств[оа]\s+знакомств|шлюбн(?:е|ого|ому|і)\s+агентств|агенц(?:ія|ії)\s+знайомств|\bmarriage\s+agency\b|\bdating\s+agency\b/i
const DATING_CHAT_ROLE = /чат-?оператор|оператор\s+чат|оператор\s+переписк|менеджер\s+переписк|переводчик\s+(?:в|для)\s+(?:чат|переписк)|correspondence\s+(?:operator|manager)|chat\s+operator|dating\s+operator/i
const DATING_CHAT_SIGNAL = /переписк[а-яёіїєґ]*\s+от\s+лиц[ао]\s+(?:девуш|женщин|клиент)|вести\s+(?:женск[а-яёіїєґ]*\s+)?анкет|ведение\s+(?:женск[а-яёіїєґ]*\s+)?анкет|анкет[а-яёіїєґ]*\s+девуш|общени[а-яёіїєґ]*\s+с\s+(?:мужчин|иностранц)|спілкуван[а-яёіїєґ]*\s+з\s+(?:чоловік|іноземц)|листа[а-яёіїєґ]*\s+від\s+імені|писать\s+письма\s+(?:мужчинам|иностранцам)|подарк[а-яёіїєґ]*\s+от\s+(?:мужчин|клиент)|letters?\s+on\s+behalf\s+of|chat\s+on\s+behalf\s+of/i

const PAID_MICROTASK = /оплат[а-яёіїєґ]*\s+(?:за\s+)?(?:кажд[а-яёіїєґ]*|одно|один)\s+(?:сообщени|лайк|комментари|пост|публикаци|рассылк|действи)|(?:платим|платят|заработок)\s+за\s+(?:сообщени|лайк|комментари|пост|публикаци|рассылк|действи)|оплата\s+за\s+(?:сообщени|лайк|комментари|пост|публикаци|рассылк|действи)|paid\s+per\s+(?:message|like|comment|post|task|action)|payment\s+per\s+(?:message|like|comment|post|task|action)/i
const MASS_SPAM_ACTION = /массов[а-яёіїєґ]*\s+рассылк|рассыл[а-яёіїєґ]*\s+(?:сообщени|текст|объявлен)|отправ[а-яёіїєґ]*\s+сообщени[а-яёіїєґ]*\s+(?:в|по)\s+(?:групп|чат)|размещ[а-яёіїєґ]*\s+(?:текст|сообщени|объявлен|пост)[а-яёіїєґ]*\s+(?:в|по)\s+(?:групп|чат)|публик[а-яёіїєґ]*\s+(?:в|по)\s+(?:групп|чат)|(?:facebook|telegram|whatsapp)\s+(?:groups?|chats?)|post\w*\s+(?:in|to)\s+(?:facebook|telegram|whatsapp)?\s*(?:groups?|chats?)/i
const SCREENSHOT_PROOF = /скриншот[а-яёіїєґ]*\s+(?:как\s+)?(?:подтверждени|отч[её]т|доказательств)|подтвержд[а-яёіїєґ]*\s+(?:выполнени[а-яёіїєґ]*\s+)?скриншот|присл[а-яёіїєґ]*\s+скриншот|screenshot\s+(?:as\s+)?(?:proof|confirmation|report)|send\s+(?:a\s+)?screenshot/i

const INFOPRODUCT_RESELL = /перепродават[а-яёіїєґ]*\s+(?:наш[а-яёіїєґ]*\s+)?(?:курс|проект)|\brich\s*team\b|онлайн[-\s]?школ[а-яёіїєґ]*\s+RT\b|\bFRLNS\s*TEAM\b/i
const MLM_TEAM_COMMISSION = /созда(?:ть|вайте|ни[ея])[а-яёіїєґ\s]*команд[а-яёіїєґ]*[^.\n]{0,120}(?:процент|%)[^.\n]{0,80}(?:товарооборот|оборот)|(?:процент|%)[^.\n]{0,80}(?:товарооборот|оборот)[^.\n]{0,120}команд|партн[её]рск[а-яёіїєґ]*\s+(?:структур|команд)[а-яёіїєґ]*[^.\n]{0,100}(?:доход|заработ)/i
const VAGUE_REMOTE_EARNINGS = /научу\s+как\s+зарабат[а-яёіїєґ]*|научим\s+зарабат[а-яёіїєґ]*|зарабат[а-яёіїєґ]*\s+не\s+выходя\s+из\s+дома|желани[а-яёіїєґ]*\s+зарабат[а-яёіїєґ]*[^.\n]{0,100}(?:особых\s+навыков\s+не\s+требуется|опыт\s+не\s+нужен)/i
const VAGUE_REMOTE_PROFILE = /особых\s+навыков\s+(?:в\s+работе\s+)?не\s+требуется|без\s+опыта|опыт\s+не\s+нужен|(?:девушк|женщин)[а-яёіїєґ\s,]*(?:от\s+)?\d{2}[\s–—-]*(?:до\s+)?\d{2}|(?:ПК|компьютер)[^.\n]{0,80}(?:интернет|доступ\s+в\s+интернет)/i
const WELLNESS_NETWORK_PROJECT = /(?:женщин[а-яёіїєґ]*\s*30\+|женщин[а-яёіїєґ]*\s+в\s+декрет|мам[а-яёіїєґ]*\s+в\s+декрет)[\s\S]{0,500}(?:онлайн[-\s]?проект|сообществ[а-яёіїєґ]*\s+поддержк)[\s\S]{0,500}(?:здоровь|продукц[а-яёіїєґ]*\s+для\s+здоровь)[\s\S]{0,500}(?:доход|зарабат|бесплатн[а-яёіїєґ]*\s+обучени)/i

const CRYPTO_JOB_SIGNAL = /цифров(?:ые|ых|ыми)\s+актив|криптовалют(?:а|ы|е|ой|ные|ных|ными)|крипто-?актив|\bDEX\b|\bDeFi\b|digital\s+assets?|crypto(?:currency)?\s+(?:services?|assets?|operations?)/i
const VAGUE_CRYPTO_DUTIES = /работа\s+с\s+(?:предоставленн[а-яёіїєґ]*\s+)?информаци[а-яёіїєґ]*|работа\s+с\s+DEX-?инструмент[а-яёіїєґ]*|выполнени[а-яёіїєґ]*\s+(?:поставленных\s+)?задач\s+по\s+готов[а-яёіїєґ]*\s+алгоритм[а-яёіїєґ]*|использовани[а-яёіїєґ]*\s+(?:необходимых\s+)?криптовалютн[а-яёіїєґ]*\s+сервис[а-яёіїєґ]*(?:\s+(?:согласно|по)\s+(?:рабочим\s+)?инструкц[а-яёіїєґ]*)?|проверка\s+данных\s+и\s+статус[а-яёіїєґ]*\s+задач|сопровождени[а-яёіїєґ]*\s+(?:текущих\s+)?процесс[а-яёіїєґ]*|контроль\s+выполнени[а-яёіїєґ]*\s+(?:поставленных\s+)?задан[а-яёіїєґ]*|ведение\s+(?:внутренн[а-яёіїєґ]*\s+отч[её]тност|рабоч[а-яёіїєґ]*\s+данн[а-яёіїєґ]*)|соблюдени[а-яёіїєґ]*\s+инструкц[а-яёіїєґ]*|сопровожда(?:ть|ете|ете\s+их)[^.\n]{0,100}(?:операц|сделк)|следи(?:ть|те)[^.\n]{0,80}(?:параметр|операц|сделк)|готов[а-яёіїєґ]*\s+торгов[а-яёіїєґ]*\s+сигнал|working\s+with\s+(?:information|data)\s+(?:in|about)\s+(?:crypto|digital\s+assets)|follow(?:ing)?\s+(?:internal\s+)?instructions\s+for\s+crypto/i
const BEGINNER_TRAINING_BAIT = /без\s+опыта|опыт[а-яёіїєґ\s]*не\s+(?:является\s+)?обязател|бесплатн[а-яёіїєґ]*\s+обучени|обучени[а-яёіїєґ]*\s+с\s+нуля|помощ[а-яёіїєґ]*\s+наставник|поддержк[а-яёіїєґ]*\s+(?:наставник|после\s+обучения)|no\s+experience|free\s+training|training\s+from\s+scratch|mentor(?:ship)?\s+(?:provided|available)/i
const TELEGRAM_RECRUITMENT = /(?:обращаться|писать|контакт|подробност[а-яёіїєґ]*|связ[а-яёіїєґ]*)[^\n]{0,80}(?:telegram|телеграм)|(?:telegram|телеграм)[^\n]{0,80}(?:@?[a-z][a-z0-9_]{4,}|t\.me\/)/i

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
  const scamContacts = testAll(SCAM_CONTACTS, text)
  const reportedScamTelegram = testAll(REPORTED_SCAM_TELEGRAM, text)
  const datingAgency = DATING_AGENCY.test(text)
  const datingChat = DATING_CHAT_ROLE.test(text) && DATING_CHAT_SIGNAL.test(text)
  const paidSpamTask = PAID_MICROTASK.test(text) && (MASS_SPAM_ACTION.test(text) || SCREENSHOT_PROOF.test(text))
  const infoproductResell = INFOPRODUCT_RESELL.test(text)
  const mlmTeamCommission = MLM_TEAM_COMMISSION.test(text)
  const vagueRemoteEarnings = VAGUE_REMOTE_EARNINGS.test(text)
    && VAGUE_REMOTE_PROFILE.test(text)
    && TELEGRAM_RECRUITMENT.test(text)
  const wellnessNetworkProject = WELLNESS_NETWORK_PROJECT.test(text)
  const cryptoTop = input.salaryMax ?? input.salaryMin
  const cryptoCurrency = String(input.salaryCurrency || '').toUpperCase()
  const highBeginnerCryptoPay = cryptoTop !== undefined
    && ((cryptoCurrency === 'EUR' || cryptoCurrency === 'USD') && cryptoTop >= 3000
      || cryptoCurrency === 'GBP' && cryptoTop >= 2500)
  const vagueCryptoRecruitment = CRYPTO_JOB_SIGNAL.test(text)
    && VAGUE_CRYPTO_DUTIES.test(text)
    && BEGINNER_TRAINING_BAIT.test(text)
    && (TELEGRAM_RECRUITMENT.test(text) || highBeginnerCryptoPay)

  if (
    scam.length
    || scamContacts.length
    || reportedScamTelegram.length
    || datingAgency
    || datingChat
    || paidSpamTask
    || infoproductResell
    || mlmTeamCommission
    || vagueRemoteEarnings
    || wellnessNetworkProject
    || vagueCryptoRecruitment
  ) {
    riskCategory = riskCategory || 'scam'
    riskReasons.push(...scam.map((r) => `scam:${r}`))
    riskReasons.push(...scamContacts.map((r) => `scam:known-contact:${r}`))
    riskReasons.push(...reportedScamTelegram.map((r) => `scam:reported-contact:${r}`))
    if (datingAgency) riskReasons.push('scam:dating-agency')
    if (datingChat) riskReasons.push('scam:dating-chat')
    if (paidSpamTask) riskReasons.push('scam:paid-spam-task')
    if (infoproductResell) riskReasons.push('scam:course-resell')
    if (mlmTeamCommission) riskReasons.push('scam:mlm-team-commission')
    if (vagueRemoteEarnings) riskReasons.push('scam:vague-remote-earnings')
    if (wellnessNetworkProject) riskReasons.push('scam:wellness-network-project')
    if (vagueCryptoRecruitment) riskReasons.push('scam:vague-crypto-recruitment')
  }

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

  const earnings = (text.match(EARNINGS_FOCUS) || []).length
  const work = (text.match(WORK_WORDS) || []).length
  if (earnings >= 3 && earnings > work) suspicionReasons.push('earnings-focused')

  const HIGH: Record<string, number> = { USD: 5000, EUR: 5000, GBP: 4000, PLN: 20000, UAH: 120000, KZT: 1500000, UZS: 40000000, RUB: 400000 }
  const cap = HIGH[String(input.salaryCurrency || '').toUpperCase()]
  const top = input.salaryMax ?? input.salaryMin
  if (cap && top && top >= cap && !hasDuties) suspicionReasons.push('high-salary-no-duties')

  return {
    riskCategory,
    riskReasons,
    suspicious: suspicionReasons.length >= 2 || riskCategory !== null,
    suspicionReasons,
  }
}
