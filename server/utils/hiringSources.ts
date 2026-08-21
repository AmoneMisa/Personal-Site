// Candidate/resume sources from public Telegram channels.
// Only public job-seeker/CV posts are accepted; employer vacancies are rejected.

import type { CvProfile, HiringSource } from './hiringTypes'
import { isLikelyTelegramVacancy } from './sources'

const UA = 'hiringFinder/1.0 (CV board; contact: admin@whiteslove.me)'
// Mixed UZ boards can publish hundreds of vacancies between two candidate
// posts. A 200-message window therefore covers too little of the required
// three-month retention period. Per-channel minimums below drive the initial
// backfill; the date cutoff stops paging as soon as the eligible window ends.
const DEFAULT_HISTORY_LIMIT = 600
const MAX_HISTORY_LIMIT = 5_000
const MIN_HISTORY_LIMIT = 50
const TELEGRAM_WORKER_PAGE_LIMIT = 200
const TELEGRAM_WORKER_TIMEOUT_MS = 60_000
// Channels are fetched four at a time over the public t.me preview, but one at
// a time through the worker: its queue is single-lane by design (parallel calls
// from one account trip FLOOD_WAIT), so fanning out only inflates the wait each
// request has to survive.
const TELEGRAM_PARALLEL_CHANNELS = 4
const MAX_CANDIDATE_AGE_MONTHS = 3
const FUTURE_DATE_TOLERANCE_MS = 48 * 60 * 60 * 1000

interface TelegramChannel {
  handle: string
  label: string
  country: string
  location: string
  tags: string[]
  cvFeed?: boolean
  includeAny?: string[]
  /** Mixed boards must contain an explicit job-seeker marker before parsing. */
  requireCandidateMarker?: boolean
  /** Minimum number of recent messages to inspect before the date cutoff wins. */
  historyLimit?: number
}

export interface HiringSourceDiagnostic {
  handle: string
  country: string
  status: 'ok' | 'empty' | 'error'
  fetched: number
  candidates: number
  checkedAt: string
  error?: string
}

interface TelegramFetchResult {
  profiles: CvProfile[]
  fetched: number
}

let telegramDiagnostics: HiringSourceDiagnostic[] = []

// Strong job-seeker forms observed in the verified UZ sources. In particular,
// `#ish #qidiryapman` is two separate hashtags and was not matched by the old
// generic intent regex.
const UZ_CANDIDATE_MARKER_RE =
  /(?:#(?:ish[_-]?kerak|menga[_-]?ish[_-]?kerak|ish[_-]?izlayapman)|#ish\s+#qidir(?:yapman|aman)|\b(?:menga\s+)?ish\s+(?:joyi\s+)?kerak\b|\bish\s+(?:qidiryapman|qidiraman|izlayapman)\b|\b(?:ish|ishga)\s+joylash(?:moqchiman|ish)\b|\b(?:я\s+)?ищу\s+(?:себе\s+)?(?:работу|подработку)\b|\bработу\s+ищу\b|\bнужна\s+(?:мне\s+)?работа\b|\bмогу\s+работать\b|#ищу\s+#работу|\b(?:у\s+пошуку|шукаю)\s+(?:роботу|підробіток)\b)/iu

// Employer language must always win over a positive hashtag. This matters for
// UZ boards where a vacancy can be tagged `#ish_izlayapman #vakansiya`.
const UZ_EMPLOYER_RE =
  /(?:#(?:ishchi[_-]?kerak|xodim[_-]?kerak|ishga[_-]?taklif[_-]?qilamiz|vakansiya)|\bvakansi(?:ya|я)\b|\bbo(?:'|’)sh\s+ish\s+o(?:'|’)rin(?:i|lari)\b|\bishga\s+(?:taklif\s+qilamiz|qabul\s+qilamiz|qabul\s+qilinadi|olamiz)\b|\b(?:xodim|hodim|ishchi)\s+kerak\b|\b(?:sotuvchi|kassir|operator|farrosh|afitsiant|ofitsiant|barmen|barista|oshpaz|haydovchi|qorovul|hamshira|o(?:'|’)qituvchi|administrator)\s+kerak\b|\btalab\s+(?:qilinadi|etiladi)\b|\bnomzod(?:ga|lar)?\s+.*?talab\b|\brezyume(?:ni)?\s+yubor(?:ing|ishingiz)\b)/iu

// Structured fields commonly used by actual self-posted CV cards. These are
// evidence of a candidate, but never override employer/vacancy signals.
const CANDIDATE_FORM_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,8}(?:ismi|ismim|f\.?i\.?o\.?|фио|имя|yoshi|yoshim|возраст|qidirayotgan\s+kasb|so(?:'|’)ralgan\s+ish\s+turi|ожидаемая\s+работа|желаемая\s+(?:должность|работа)|tajriba|опыт\s+работы)\s*[:—-]/imu

// Verified during the August 2026 audit. Mixed boards are listed only when
// recent candidate posts were found; vacancy-only/dead/wrong-entity handles are
// deliberately absent.
const DEFAULT_CV_CHANNELS: TelegramChannel[] = [
  // Uzbekistan — Tashkent + regions, broad mass-market coverage. Every mixed
  // source requires an explicit candidate marker so its vacancy stream cannot
  // leak into /hiring.
  { handle: 'ISH_QIDIR', label: 'Ish Qidir', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 3_000 },
  { handle: 'myrabota_uz', label: 'Работа в Ташкенте', country: 'UZ', location: 'Tashkent', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },
  { handle: 'UzJobs', label: 'UzJobs', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 5_000 },
  { handle: 'uzb_vakansiya', label: 'UZB Vakansiya', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 3_000 },
  { handle: 'ishchi', label: 'ISHCHI', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 3_000 },
  { handle: 'ishbor_olx_uz', label: 'OLX.UZ Ish', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 5_000 },
  { handle: 'ISH_QAYERDA', label: 'Ish Qayerda', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Education'], requireCandidateMarker: true, historyLimit: 3_000 },
  { handle: 'UstozShogird', label: 'Ustoz Shogird', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'IT', 'Student'], requireCandidateMarker: true, historyLimit: 3_000 },
  { handle: 'TALIMDAN_ISH_TOPISH', label: 'Taʼlimdan ish topish', country: 'UZ', location: 'Tashkent', tags: ['Resume', 'Education'], requireCandidateMarker: true, historyLimit: 3_000 },
  { handle: 'SAMARQAND_ISH', label: 'Samarqand ish', country: 'UZ', location: 'Samarkand', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },
  { handle: 'Fargona_ishlar', label: 'Fargona ishlar', country: 'UZ', location: 'Fergana', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },
  { handle: 'Ishga_marhamat_andijon_elonlar', label: 'Andijon ish', country: 'UZ', location: 'Andijan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },
  { handle: 'namanganishbor', label: 'Namangan ish', country: 'UZ', location: 'Namangan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },
  { handle: 'buxoroda_ish', label: 'Buxoroda ish', country: 'UZ', location: 'Bukhara', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },
  { handle: 'Xorazm_ish', label: 'Xorazm ish', country: 'UZ', location: 'Uzbekistan', tags: ['Resume', 'Mass market'], requireCandidateMarker: true, historyLimit: 2_000 },

  // Kazakhstan — verified current resume flow; primarily IT for now.
  { handle: 'workitkz', label: 'workITkz', country: 'KZ', location: 'Kazakhstan', tags: ['Resume', 'IT'], historyLimit: 1_500 },

  // Kyrgyzstan.
  { handle: 'jobslbish', label: 'Jobs.bish', country: 'KG', location: 'Bishkek', tags: ['Resume', 'Mass market'], historyLimit: 1_500 },
  {
    handle: 'Cvflow',
    label: 'CV Flow',
    country: 'KG',
    location: 'Kyrgyzstan',
    tags: ['Resume', 'IT'],
    cvFeed: true,
    includeAny: ['kyrgyzstan', 'кыргызстан', 'bishkek', 'бишкек', 'osh', 'ош'],
    historyLimit: 1_500,
  },

  // Ukraine — candidate-heavy professional feeds. City is parsed from each post.
  { handle: 'itcandidatesUA', label: 'IT Candidates UA', country: 'UA', location: 'Ukraine', tags: ['Resume', 'IT'], cvFeed: true, historyLimit: 1_500 },
  { handle: 'hr_recruiter_ua', label: 'HR & Recruiters UA', country: 'UA', location: 'Ukraine', tags: ['Resume', 'HR'], historyLimit: 1_500 },
]

const CITY_ALIASES: Record<string, Array<[string, RegExp]>> = {
  UZ: [
    ['Tashkent', /\b(?:tashkent|toshkent|ташкент|тошкент)\b/iu],
    ['Samarkand', /\b(?:samarkand|samarqand|самарканд|самарқанд)\b/iu],
    ['Bukhara', /\b(?:bukhara|buxoro|бухара|бухоро)\b/iu],
    ['Namangan', /\b(?:namangan|наманган)\b/iu],
    ['Andijan', /\b(?:andijan|andijon|андижан|андижон)\b/iu],
    ['Fergana', /\b(?:fergana|farg(?:'|’)ona|фаргана|фергана)\b/iu],
    ['Qarshi', /\b(?:qarshi|karshi|карши|қарши)\b/iu],
    ['Nukus', /\b(?:nukus|нукус)\b/iu],
    ['Urgench', /\b(?:urgench|urganch|ургенч|урганч)\b/iu],
    ['Khiva', /\b(?:khiva|xiva|хива)\b/iu],
  ],
  UA: [
    ['Kyiv', /\b(?:kyiv|kiev|київ|киев)\b/iu],
    ['Kharkiv', /\b(?:kharkiv|kharkov|харків|харьков)\b/iu],
    ['Odesa', /\b(?:odesa|odessa|одеса|одесса)\b/iu],
    ['Dnipro', /\b(?:dnipro|дніпро|днепр)\b/iu],
    ['Lviv', /\b(?:lviv|львів|львов)\b/iu],
    ['Vinnytsia', /\b(?:vinnytsia|vinnitsa|вінниця|винница)\b/iu],
    ['Zaporizhzhia', /\b(?:zaporizhzhia|zaporozhye|запоріжжя|запорожье)\b/iu],
  ],
  KZ: [
    ['Almaty', /\b(?:almaty|алматы)\b/iu],
    ['Astana', /\b(?:astana|астана)\b/iu],
    ['Shymkent', /\b(?:shymkent|chimkent|шымкент|чимкент)\b/iu],
    ['Karaganda', /\b(?:karaganda|караганда)\b/iu],
    ['Atyrau', /\b(?:atyrau|атырау)\b/iu],
    ['Aktobe', /\b(?:aktobe|актобе)\b/iu],
  ],
  KG: [
    ['Bishkek', /\b(?:bishkek|бишкек)\b/iu],
    ['Osh', /\b(?:osh|ош)\b/iu],
    ['Karakol', /\b(?:karakol|каракол)\b/iu],
  ],
}

const TASHKENT_DISTRICTS: Array<[string, RegExp]> = [
  ['Chilanzar', /\b(?:chilanzar|chilonzor|чиланзар|чилонзор)\b/iu],
  ['Yunusabad', /\b(?:yunusabad|yunusobod|юнасабад|юнусобод)\b/iu],
  ['Mirabad', /\b(?:mirabad|mirobod|мирабад|миробод)\b/iu],
  ['Yakkasaray', /\b(?:yakkasaray|yakkasaroy|яккасарай|яккасарой)\b/iu],
  ['Shaykhantahur', /\b(?:shaykhantahur|shayxontohur|шейхантахур|шайхонтохур)\b/iu],
  ['Mirzo Ulugbek', /\b(?:mirzo\s+ulugbek|mirzo\s+ulug(?:'|’)bek|мирзо\s+улугбек)\b/iu],
  ['Uchtepa', /\b(?:uchtepa|учтепа)\b/iu],
  ['Sergeli', /\b(?:sergeli|сергели)\b/iu],
  ['Bektemir', /\b(?:bektemir|бектемир)\b/iu],
  ['Almazar', /\b(?:almazar|olmazor|алмазар|олмазор)\b/iu],
  ['Yashnabad', /\b(?:yashnabad|yashnobod|яшнабад|яшнобод)\b/iu],
]

function telegramChannels(): TelegramChannel[] {
  const raw = process.env.HIRING_TELEGRAM_CHANNELS
  if (!raw?.trim()) return DEFAULT_CV_CHANNELS
  return raw.split(',').map((entry) => {
    const [handle = '', label = '', country = 'UZ'] = entry.split(':').map((part) => part.trim())
    return {
      handle,
      label: label || handle,
      country: country.toUpperCase(),
      location: label || country,
      tags: ['Resume'],
      cvFeed: true,
      requireCandidateMarker: country.toUpperCase() === 'UZ',
      historyLimit: country.toUpperCase() === 'UZ' ? 2_000 : 1_500,
    }
  }).filter((channel) => channel.handle)
}

function telegramHistoryLimit(channel: TelegramChannel): number {
  const requested = Number(process.env.HIRING_TELEGRAM_HISTORY_LIMIT || DEFAULT_HISTORY_LIMIT)
  const envLimit = Number.isFinite(requested) ? requested : DEFAULT_HISTORY_LIMIT
  // A stale production env value such as 200 must not silently undo the deep
  // backfill required by a verified mixed board. Env can raise, not lower, a
  // source-specific minimum.
  const wanted = Math.max(envLimit, channel.historyLimit || DEFAULT_HISTORY_LIMIT)
  return Math.min(MAX_HISTORY_LIMIT, Math.max(MIN_HISTORY_LIMIT, Math.round(wanted)))
}

function candidateCutoff(): number {
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_CANDIDATE_AGE_MONTHS)
  return cutoff.getTime()
}

function recentCandidateDate(dateIso: string | null | undefined): string | null {
  if (!dateIso) return null
  const date = new Date(dateIso)
  if (!Number.isFinite(date.getTime())) return null
  const now = new Date()
  if (date.getTime() < candidateCutoff() || date.getTime() > now.getTime() + FUTURE_DATE_TOLERANCE_MS) return null
  return date.toISOString()
}

const CANDIDATE_INTENT_RE =
  /(?:#(?:ищу[_-]?(?:работу|подработку)|ищуработу|шукаю[_-]?(?:роботу|підробіток)|шукаюроботу|кандидат(?:ка)?|резюме|resume|cv|ish[_-]?kerak|ish[_-]?izlayapman|menga[_-]?ish[_-]?kerak)|#ищу\s+#работу|#ish\s+#qidir(?:yapman|aman)|\b(?:ищу|шукаю)\s+(?:себе\s+)?(?:работу|подработку|роботу|підробіток)|\b(?:работу\s+ищу|нужна\s+(?:мне\s+)?работа|могу\s+работать)|\b(?:у\s+пошуках?\s+роботи|у\s+пошуку\s+роботи|розглядаю\s+пропозиції|нахожусь\s+в\s+поиске\s+работы|в\s+поиске\s+работы)|\b(?:menga\s+ish\s+kerak|ish\s+(?:joyi\s+)?kerak|ish\s+(?:izlayapman|qidiryapman|qidiraman))|\b(?:looking\s+for\s+(?:a\s+)?(?:job|work|opportunit(?:y|ies))|open\s+to\s+work))/iu
const CV_MARKER_RE = /(?:резюме|resume|\bcv\b|curriculum vitae|анкета|профиль кандидата|профіль кандидата|кандидат(?:ка)?|candidate profile|mening\s+(?:cv|rezume)|my\s+cv)/iu
const FIRST_PERSON_RE = /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,6}(?:я[\s—,-]|я\s+(?:ищу|шукаю)|men[\s,]|mening[\s,]|my name is|i am a|i'm a|ismim\b)/iu
const EMPLOYER_RE = /(?:we(?:'re| are)\s+(?:hiring|looking\s+for)|(?:^|\n)\s*[^\p{L}\p{N}\n]{0,10}(?:ищем|требуется|требуются|вакансия|компания\s+ищет|шукаємо|потрібен|потрібна|потрібні|вакансія|запрошуємо|hiring|vacancy|ishchi\s+kerak|xodim\s+kerak|ishga\s+(?:taklif|qabul)|bo(?:'|’)sh\s+ish\s+o(?:'|’)rni))/iu
const VACANCY_SECTION_RE = /(?:requirements?|responsibilit|qualifications?|обязанност|требован|условия\s+работ|мы\s+предлагаем|обов(?:'|’)язк|вимог|ми\s+пропонуємо|what we offer|надсилайте\s+резюме|присылайте\s+резюме|(?:^|\n)\s*(?:talablar|vazifalar)\s*[:—-]|biz\s+taklif\s+qilamiz)/imu
const ROLE_RE = /\b(?:developer|engineer|designer|manager|analyst|specialist|qa|tester|devops|frontend|backend|accountant|cashier|seller|driver|builder|welder|cleaner|waiter|cook|guard|courier|teacher|tutor|nanny|nurse|doctor|dentist|pharmacist|bartender|barista|trainer|coach|administrator|director|supervisor|receptionist|hostess|promoter|packer)\b|разработ|инженер|інженер|дизайнер|менеджер|аналитик|аналітик|специалист|спеціаліст|бухгалтер|кассир|касир|продав|водител|водій|строит|будівел|сварщик|зварюваль|убор|прибирал|официант|офіціант|бармен|бариста|повар|кухар|охран|охорон|управляющ|керівник|директор|администратор|адміністратор|супервайзер|курьер|кур'єр|учител|вчител|преподав|викладач|репетитор|воспитател|виховател|нян|врач|лікар|стоматолог|фармацевт|медсестр|медбрат|тренер|рецепционист|рецепціоніст|хостес|промоутер|упаковщик|dasturchi|menejer|buxgalter|kassir|sotuvchi|haydovchi|shafyor|qurilish|payvandchi|farrosh|afitsant|barmen|oshpaz|qorovul|boshqaruv|kuryer|o(?:'|’)qituvchi|repetitor|tarbiyachi|enaga|shifokor|hamshira/iu
const CONTACT_RE = /(?:\+?\d[\d\s()\-]{7,}|@[a-z0-9_]{4,}|(?:telegram|телефон|phone|tel|aloqa|murojaat|bog(?:'|’)lanish)\s*[:—-])/iu
const PROMOTION_RE = /t\.me\/addlist\b|(?:telegram[- ]?)?канал\w*\s+(?:в\s+)?(?:одн\w+\s+)?папк|добав(?:ить|ьте)\s+(?:свой\s+)?канал/iu

const SECTION_PATTERNS = {
  experience: /(?:опыт|досвід|experience|staj|tajriba|ish\s+tajribasi)/iu,
  skills: /(?:skills|навыки|навички|умею|стек|stack|technologies|texnologiyalar|ko(?:'|’)nikmalar)/iu,
  education: /(?:education|образован|освіт|o(?:'|’)qish|ta(?:'|’)lim|университет|університет|university|college|institut)/iu,
  languages: /(?:languages|языки|мови|til(?:lar)?|language skills)/iu,
  contact: /(?:contact|контакт|telegram|телефон|phone|tel|bog(?:'|’)lanish|aloqa)/iu,
}

function cvSectionCount(text: string): number {
  return Object.values(SECTION_PATTERNS).filter((pattern) => pattern.test(text)).length
}

export function isLikelyCvPost(text: string, cvFeed = false): boolean {
  const value = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').trim()
  const compact = value.replace(/\s+/g, ' ')
  if (compact.length < 30 || PROMOTION_RE.test(value)) return false

  const explicitIntent = CANDIDATE_INTENT_RE.test(value)
  const candidateForm = CANDIDATE_FORM_RE.test(value)
  // Strong employer structure has precedence even if the board used a sloppy
  // candidate-looking hashtag in the same post.
  if (EMPLOYER_RE.test(value) || UZ_EMPLOYER_RE.test(value) || VACANCY_SECTION_RE.test(value)) return false
  if (!explicitIntent && !candidateForm && isLikelyTelegramVacancy(compact)) return false

  const hasCvMarker = CV_MARKER_RE.test(value)
  const firstPerson = FIRST_PERSON_RE.test(value)
  const hasRole = ROLE_RE.test(value)
  const hasContact = CONTACT_RE.test(value)
  const sections = cvSectionCount(value)
  const hasExperience = /(?:\d+\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)|(?:опыт|досвід|experience|staj|tajriba)\s*[:—-]?\s*\d)/iu.test(value)

  // The old `compact.length >= 60` branch admitted long but otherwise
  // unstructured ads. A job-seeker intent now needs actual candidate evidence.
  if (explicitIntent && (firstPerson || candidateForm || hasRole || hasContact || sections >= 1)) return true
  if (hasCvMarker && (candidateForm || hasRole || sections >= 1 || hasContact)) return true
  if (cvFeed && (firstPerson || hasCvMarker || candidateForm) && (hasRole || sections >= 1 || hasExperience || hasContact)) return true
  if (firstPerson && hasRole && (candidateForm || sections >= 1 || hasExperience || hasContact)) return true
  return false
}

function decodeTelegramEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x'
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function telegramText(html: string): string {
  return decodeTelegramEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').trim()
}

function field(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]\\s*([^\\n]{2,220})`, 'iu'))
  return match?.[1]?.trim()
}

function blockAfter(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]?\\s*\\n([\\s\\S]{10,800}?)(?=\\n[^\\p{L}\\p{N}\\n]{0,8}(?:experience|опыт|досвід|skills|навыки|навички|education|образован|освіта|languages|языки|мови|contact|контакт|телефон)\\s*[:—-]|$)`, 'iu'))
  return match?.[1]?.replace(/\s+/g, ' ').trim()
}

const MAX_PLAUSIBLE_EXPERIENCE_YEARS = 55

function parseExperience(text: string): number | undefined {
  const match = text.match(/(?:опыт|досвід|experience|staj|tajriba)\s*[:—-]?\s*(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)?/iu)
    // The keyword is required on this side: a bare "80 років" is somebody's
    // age, not their career.
    || text.match(/(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)\s+(?:опыт\p{L}*|досвід\p{L}*|experience|tajriba\p{L}*|staj\p{L}*)/iu)
    || text.match(/(?:опыт|досвід|experience|staj|tajriba)\p{L}*\s+(?:работы|роботи|of\s+work)?\s*[:—-]?\s*(\d+)/iu)
  const years = match ? Number(match[1]) : undefined
  if (!Number.isFinite(years)) return undefined
  return years > 0 && years <= MAX_PLAUSIBLE_EXPERIENCE_YEARS ? years : undefined
}

function parseName(text: string): string {
  return (field(text, "фио|ф\.и\.о\.?|піб|full name|name|имя|ім(?:ʼ|')я|fio|ism|ismim") || '').slice(0, 100)
}

function parseRole(text: string): string {
  const targetNames = 'желаемая (?:работа|должность)|бажана (?:робота|посада)|ожидаемая работа|ищу работу|шукаю роботу|ish kerak|menga ish kerak|ish joyi kerak|qidirayotgan kasb|so(?:\'|’)ralgan ish turi|position|role|должность|позиция|посада|lavozim|kasb(?:i|im)?|mutaxassislik|specialization|специализация|target role'
  const explicit = field(text, targetNames)
  if (explicit && ROLE_RE.test(explicit)) return explicit.slice(0, 180)

  const targetBlock = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${targetNames})\\s*[:—-]?\\s*\\n([^\\n]{2,220})`, 'iu'))?.[1]?.trim()
  if (targetBlock && ROLE_RE.test(targetBlock)) return targetBlock.slice(0, 180)

  const intentLine = text.split('\n').find((line) => CANDIDATE_INTENT_RE.test(line) && ROLE_RE.test(line))
  if (intentLine) return intentLine.replace(CANDIDATE_INTENT_RE, '').replace(/^\s*[:—-]\s*/, '').slice(0, 180)

  const roleLine = text.split('\n').map((value) => value.trim()).find((value) => ROLE_RE.test(value) && value.length <= 180)
  return roleLine?.slice(0, 180) || ''
}

function parseSkills(text: string): string[] {
  const skillsLine = field(text, "skills|навыки|навички|умею|стек|stack|technologies|texnologiyalar|ko['’]nikmalar")
  const source = skillsLine || ''
  if (!source) return []
  return [...new Set(source.split(/[,;/|•·]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 60))].slice(0, 20)
}

function parseLanguages(text: string): string[] {
  const raw = field(text, 'languages|языки|мови|til(?:lar)?|language skills') || blockAfter(text, 'languages|языки|мови|til(?:lar)?')
  return raw ? raw.split(/[,;/|•·]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8) : []
}

function detectCity(text: string, country: string): string | null {
  for (const [city, pattern] of CITY_ALIASES[country] || []) {
    if (pattern.test(text)) return city
  }
  return null
}

function fallbackChannelCity(channel: TelegramChannel): string | null {
  return (CITY_ALIASES[channel.country] || []).some(([city]) => city === channel.location) ? channel.location : null
}

function detectDistrict(text: string, city: string | null): string | null {
  const explicit = field(text, 'район|р-н|district|туман|tumani')
  if (explicit) return explicit
  if (city !== 'Tashkent') return null
  for (const [district, pattern] of TASHKENT_DISTRICTS) {
    if (pattern.test(text)) return district
  }
  return null
}

function parseMoneyNumber(raw: string): number | null {
  let value = raw.trim().replace(/\s+/g, '')
  if (!value) return null
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) value = value.replace(/[.,]/g, '')
  else value = value.replace(',', '.')
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseSalary(text: string, country: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const raw = field(text, 'ожидания по (?:зп|зарплате)|зарплата|зп|бажана зарплата|salary|expected salary|oylik|maosh|ish haqi|shaxsiy talab')
  if (!raw) return {}
  const numbers = (raw.match(/\d[\d\s.,]*\d|\d/g) || []).map(parseMoneyNumber).filter((value): value is number => value != null)
  if (!numbers.length) return {}
  const multiplier = /(?:млн|million|mln)/iu.test(raw) ? 1_000_000 : /(?:тыс|тис|thousand|ming)/iu.test(raw) ? 1_000 : 1
  const values = numbers.slice(0, 2).map((value) => Math.round(value * multiplier))
  const currency = /(?:\$|usd|доллар)/iu.test(raw) ? 'USD'
    : /(?:uzs|сум|so(?:'|’)m)/iu.test(raw) ? 'UZS'
      : /(?:uah|грн|грив)/iu.test(raw) ? 'UAH'
        : /(?:kzt|₸|тенге|тг)/iu.test(raw) ? 'KZT'
          : /(?:kgs|сом)/iu.test(raw) ? 'KGS'
            : ({ UZ: 'UZS', UA: 'UAH', KZ: 'KZT', KG: 'KGS' } as Record<string, string>)[country]
  return values.length > 1
    ? { salaryMin: Math.min(...values), salaryMax: Math.max(...values), currency }
    : { salaryMin: values[0], salaryMax: values[0], currency }
}

function messageToProfile(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramChannel,
  needle: string,
): CvProfile | null {
  const createdAt = recentCandidateDate(opts.dateIso)
  if (!createdAt) return null
  const lowerText = text.toLocaleLowerCase('ru')
  if (channel.includeAny?.length && !channel.includeAny.some((marker) => lowerText.includes(marker.toLocaleLowerCase('ru')))) return null
  // UZ mixed feeds must explicitly say that the person is looking for work.
  // This source-level gate is intentionally stricter than the generic parser.
  if (channel.requireCandidateMarker && !UZ_CANDIDATE_MARKER_RE.test(text)) return null
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = parseName(text)
  const role = parseRole(text)
  const skills = parseSkills(text)
  if (needle && !`${name} ${role} ${text} ${skills.join(' ')}`.toLocaleLowerCase('ru').includes(needle)) return null

  const explicitCity = field(text, 'location|city|локация|локація|город|місто|shahar|manzil|hozirgi manzil')
  const city = explicitCity || detectCity(text, channel.country) || fallbackChannelCity(channel)
  const district = detectDistrict(text, city)
  const contact = field(text, 'contact|контакт|telegram|phone|телефон|tel|telefon|boglanish|aloqa|murojaat')
  const employmentType = field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')
  const education = field(text, "education|образование|освіта|o['’]qish|ta['’]lim|ma['’]lumoti|diplom") || blockAfter(text, "education|образование|освіта|o['’]qish|ta['’]lim|ma['’]lumoti|diplom") || null
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((match) => match[1]!)
  const salary = parseSalary(text, channel.country)

  return {
    id: opts.id,
    source: 'telegram',
    country: channel.country,
    name,
    role,
    experienceYears: parseExperience(text),
    ...salary,
    city,
    district,
    remote: /remote|удалён|удален|віддален|дистанц|masofaviy|online|онлайн/i.test(`${role} ${text}`),
    url: opts.url,
    createdAt,
    originalText: text,
    description: text,
    skills,
    languages: parseLanguages(text),
    education,
    tags: [...channel.tags, channel.country, `@${channel.handle}`, ...hashtags].slice(0, 10),
    contact,
    employmentType,
  }
}

interface TelegramWorkerMessage { id: number; text: string; date: string | null; preview?: string | null }
interface TelegramWorkerHistory { ok?: boolean; messages?: TelegramWorkerMessage[]; minId?: number | null }

async function fetchChannelViaWorker(base: string, channel: TelegramChannel, q: string): Promise<TelegramFetchResult> {
  const target = telegramHistoryLimit(channel)
  const cutoff = candidateCutoff()
  const needle = q.trim().toLocaleLowerCase('ru')
  const profiles: CvProfile[] = []
  let fetched = 0
  let beforeId = 0

  while (fetched < target) {
    const pageLimit = Math.min(TELEGRAM_WORKER_PAGE_LIMIT, target - fetched)
    const params = new URLSearchParams({ channel: channel.handle, limit: String(pageLimit) })
    if (beforeId > 0) params.set('beforeId', String(beforeId))
    const res = await fetch(`${base.replace(/\/+$/, '')}/history?${params}`, { signal: AbortSignal.timeout(TELEGRAM_WORKER_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`tg-worker @${channel.handle} -> ${res.status}`)
    const data = (await res.json()) as TelegramWorkerHistory
    if (!data.ok || !Array.isArray(data.messages)) throw new Error(`tg-worker @${channel.handle} bad payload`)
    if (!data.messages.length) break

    for (const message of data.messages) {
      const text = [(message.text || '').trim(), (message.preview || '').trim()].filter(Boolean).join('\n')
      if (!text) continue
      const profile = messageToProfile(text, {
        id: `telegram-${channel.handle}-${message.id}`,
        url: `https://t.me/${channel.handle}/${message.id}`,
        dateIso: message.date,
      }, channel, needle)
      if (profile) profiles.push(profile)
    }

    fetched += data.messages.length

    // Telegram history is newest -> oldest. Once a page reaches beyond the
    // three-month retention boundary, every later page is ineligible and the
    // backfill is complete even when the numeric cap is much higher.
    const dates = data.messages
      .map((message) => message.date ? Date.parse(message.date) : Number.NaN)
      .filter(Number.isFinite)
    if (dates.length && Math.min(...dates) < cutoff) break

    const ids = data.messages.map((message) => message.id).filter(Number.isFinite)
    const nextBeforeId = Number(data.minId) || (ids.length ? Math.min(...ids) : 0)
    if (!nextBeforeId || nextBeforeId === beforeId || data.messages.length < pageLimit) break
    beforeId = nextBeforeId
  }
  return { profiles, fetched }
}

function parseChannelHtml(html: string, channel: TelegramChannel, q: string): TelegramFetchResult {
  const profiles: CvProfile[] = []
  const chunks = html.split(/<div class="tgme_widget_message_wrap\b[^>]*>/i).slice(1)
  const needle = q.trim().toLocaleLowerCase('ru')
  for (const chunk of chunks) {
    const postId = chunk.match(/data-post="([^"]+)"/i)?.[1]
    const body = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    if (!postId || !body) continue
    const datetime = chunk.match(/<time[^>]+datetime="([^"]+)"/i)?.[1]
    const profile = messageToProfile(telegramText(body), {
      id: `telegram-${postId.replace(/[^a-z0-9_-]+/gi, '-')}`,
      url: `https://t.me/${postId}`,
      dateIso: datetime,
    }, channel, needle)
    if (profile) profiles.push(profile)
  }
  return { profiles, fetched: chunks.length }
}

async function fetchTelegramChannel(channel: TelegramChannel, q: string): Promise<TelegramFetchResult> {
  const workerUrl = process.env.TELEGRAM_WORKER_URL
  if (workerUrl) return fetchChannelViaWorker(workerUrl, channel, q)
  const res = await fetch(`https://t.me/s/${encodeURIComponent(channel.handle)}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`t.me/@${channel.handle} -> ${res.status}`)
  return parseChannelHtml(await res.text(), channel, q)
}

interface ChannelOutcome {
  result: TelegramFetchResult
  diagnostic: HiringSourceDiagnostic
}

// One channel, never throwing: a dead handle is a diagnostic, not a reason to
// abandon the other channels in the batch.
async function readChannel(channel: TelegramChannel, q: string): Promise<ChannelOutcome> {
  const checkedAt = new Date().toISOString()
  try {
    const result = await fetchTelegramChannel(channel, q)
    return {
      result,
      diagnostic: {
        handle: channel.handle,
        country: channel.country,
        status: result.profiles.length ? 'ok' : 'empty',
        fetched: result.fetched,
        candidates: result.profiles.length,
        checkedAt,
      },
    }
  } catch (err) {
    const error = (err as Error).message
    console.error(`[hiring] telegram @${channel.handle} failed:`, error)
    return {
      result: { profiles: [], fetched: 0 },
      diagnostic: {
        handle: channel.handle,
        country: channel.country,
        status: 'error',
        fetched: 0,
        candidates: 0,
        checkedAt,
        error,
      },
    }
  }
}

/** Configured handles, in fetch order — the queue dispatcher fans these out. */
export function hiringChannelHandles(): string[] {
  return telegramChannels().map((channel) => channel.handle)
}

/**
 * Refreshes a single channel, for the per-channel queue tasks. The shared
 * diagnostics list is patched in place so /hiring-feed keeps reporting one row
 * per channel no matter which path last refreshed it.
 */
export async function fetchHiringChannel(handle: string, q = ''): Promise<ChannelOutcome | null> {
  if (process.env.TELEGRAM_SOURCE === 'off') return null
  const wanted = handle.replace(/^@/, '').toLowerCase()
  const channel = telegramChannels().find((item) => item.handle.toLowerCase() === wanted)
  if (!channel) return null

  const outcome = await readChannel(channel, q)
  const index = telegramDiagnostics.findIndex((item) => item.handle.toLowerCase() === wanted)
  if (index >= 0) telegramDiagnostics[index] = outcome.diagnostic
  else telegramDiagnostics = [...telegramDiagnostics, outcome.diagnostic]
  return outcome
}

export async function fetchHiringTelegram(q: string): Promise<CvProfile[]> {
  if (process.env.TELEGRAM_SOURCE === 'off') return []
  const channels = telegramChannels()
  const profiles: CvProfile[] = []
  const diagnostics: HiringSourceDiagnostic[] = []

  const stride = process.env.TELEGRAM_WORKER_URL ? 1 : TELEGRAM_PARALLEL_CHANNELS
  for (let start = 0; start < channels.length; start += stride) {
    const results = await Promise.all(channels.slice(start, start + stride).map((channel) => readChannel(channel, q)))
    for (const item of results) {
      profiles.push(...item.result.profiles)
      diagnostics.push(item.diagnostic)
    }
  }

  telegramDiagnostics = diagnostics
  return profiles
}

export function getHiringSourceDiagnostics(): HiringSourceDiagnostic[] {
  return telegramDiagnostics.map((item) => ({ ...item }))
}

const FETCHERS: Record<HiringSource, (q: string) => Promise<CvProfile[]>> = { telegram: fetchHiringTelegram }

export function isHiringSourceConfigured(source: HiringSource): boolean {
  return source === 'telegram' && process.env.TELEGRAM_SOURCE !== 'off'
}

export async function fetchHiringSource(source: HiringSource, q = ''): Promise<CvProfile[]> {
  return FETCHERS[source](q)
}

export const HIRING_COUNTRIES = [
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', cities: ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Qarshi', 'Nukus', 'Urgench', 'Khiva'] },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', cities: ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro', 'Vinnytsia', 'Zaporizhzhia'] },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', cities: ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Atyrau', 'Aktobe'] },
  { code: 'KG', name: 'Kyrgyzstan', currency: 'KGS', cities: ['Bishkek', 'Osh', 'Karakol'] },
] as const
