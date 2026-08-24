// Candidate/resume sources from public Telegram channels.
// Only public job-seeker/CV posts are accepted; employer vacancies are rejected.

import type { CvProfile } from './hiringTypes'
import { emptyCursor, loadCursors, saveCursor, type ChannelCursor } from './hiringCursors'
import { isLikelyTelegramVacancy } from './sources'
import { cityRe } from './hiringWebFields'
import { extractCandidateName } from './hiringCandidateFields'
import {
  HIRING_TELEGRAM_CHANNELS,
  type HiringTelegramChannelDescriptor,
} from '../../shared/hiring/sources/telegramChannels'

const UA = 'hiringFinder/1.0 (CV board; contact: admin@whiteslove.me)'
const DEFAULT_HISTORY_LIMIT = 600
const MAX_HISTORY_LIMIT = 5_000
const MIN_HISTORY_LIMIT = 50
const TELEGRAM_WORKER_PAGE_LIMIT = 200
const TELEGRAM_PAGE_SIZE = Math.min(
  200,
  Math.max(50, Number(process.env.HIRING_TELEGRAM_PAGE_SIZE) || 150),
)
const TELEGRAM_WORKER_TIMEOUT_MS = 60_000
const MAX_CANDIDATE_AGE_MONTHS = 3
const FUTURE_DATE_TOLERANCE_MS = 48 * 60 * 60 * 1000

type TelegramChannel = HiringTelegramChannelDescriptor

export interface HiringSourceDiagnostic {
  handle: string
  country: string
  status: 'ok' | 'empty' | 'error' | 'disabled'
  /** Messages read from Telegram in this round. */
  fetched: number
  /** Posts carrying an explicit "I am looking for work" marker. */
  candidateMarkerMatched: number
  /** Rejected because the post is an employer vacancy. */
  rejectedVacancy: number
  /** Rejected by the CV/quality parser (not a profile, or unusable). */
  rejectedQuality: number
  /** Profiles this round produced, before store-level dedup and retention. */
  candidates: number
  mode: 'incremental' | 'backfill' | 'idle'
  newestMessageId: number
  oldestMessageId: number
  bootstrapComplete: boolean
  fetchDurationMs: number
  checkedAt: string
  error?: string
}

/** Per-channel counters a single crawl round produced. */
export interface ChannelFunnel {
  fetched: number
  candidateMarkerMatched: number
  rejectedVacancy: number
  rejectedQuality: number
  candidates: number
}

function emptyFunnel(): ChannelFunnel {
  return { fetched: 0, candidateMarkerMatched: 0, rejectedVacancy: 0, rejectedQuality: 0, candidates: 0 }
}

interface TelegramFetchResult {
  profiles: CvProfile[]
  fetched: number
}

let telegramDiagnostics: HiringSourceDiagnostic[] = []

const UZ_CANDIDATE_MARKER_RE =
  /(?:#(?:ish[_-]?kerak|menga[_-]?ish[_-]?kerak|ish[_-]?izlayapman)|#ish\s+#qidir(?:yapman|aman)|\b(?:menga\s+)?ish\s+(?:joyi\s+)?kerak\b|\bish\s+(?:qidiryapman|qidiraman|izlayapman)\b|\b(?:ish|ishga)\s+joylash(?:moqchiman|ish)\b|(?:^|\n)\s*so(?:['’‘])ralgan\s+ish\s+(?:joyi|turi)\s*[:—-]|(?<![\p{L}\p{N}])(?:я\s+)?ищу\s+(?:себе\s+)?(?:работу|подработку)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])работу\s+ищу(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])нужна\s+(?:мне\s+)?работа(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])могу\s+работать(?![\p{L}\p{N}])|#ищу\s+#работу|(?<![\p{L}\p{N}])(?:у\s+пошуку|шукаю)\s+(?:роботу|підробіток)(?![\p{L}\p{N}]))/iu

const UZ_EMPLOYER_RE =
  /(?:#(?:ishchi[_-]?kerak|xodim[_-]?kerak|ishga[_-]?taklif[_-]?qilamiz|vakansiya)|\bvakansi(?:ya|я)\b|\bbo(?:'|’)sh\s+ish\s+o(?:'|’)rin(?:i|lari)\b|\bishga\s+(?:taklif\s+qilamiz|qabul\s+qilamiz|qabul\s+qilinadi|olamiz)\b|\b(?:xodim|hodim|ishchi)\s+kerak\b|\b(?:sotuvchi|kassir|operator|farrosh|afitsiant|ofitsiant|barmen|barista|oshpaz|haydovchi|qorovul|hamshira|o(?:'|’)qituvchi|administrator)\s+kerak\b|\btalab\s+(?:qilinadi|etiladi)\b|\bnomzod(?:ga|lar)?\s+.*?talab\b|\brezyume(?:ni)?\s+yubor(?:ing|ishingiz)\b)/iu

const CANDIDATE_FORM_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,8}(?:ism(?:i|im)?(?:\s*[-–—]\s*(?:familya|familiya))?|familya|familiya|f\.?i\.?o\.?|фио|имя|yoshi|yoshim|tug(?:['’‘])ilgan\s+yili|возраст|qidirayotgan\s+kasb|so(?:['’‘])ralgan\s+ish\s+(?:joyi|turi)|yashash\s+manzili|ma(?:['’‘])lumoti|ожидаемая\s+работа|желаемая\s+(?:должность|работа)|tajribasi?|опыт\s+работы)\s*[:—-]/imu

const CITY_ALIASES: Record<string, Array<[string, RegExp]>> = {
  UZ: [
    ['Tashkent', cityRe('tashkent|toshkent|ташкент|тошкент')],
    ['Samarkand', cityRe('samarkand|samarqand|самарканд|самарқанд')],
    ['Bukhara', cityRe('bukhara|buxoro|бухара|бухоро')],
    ['Namangan', cityRe('namangan|наманган')],
    ['Andijan', cityRe('andijan|andijon|anjan|anjon|андижан|андижон')],
    ['Fergana', cityRe("fergana|farg(?:'|’)ona|фаргана|фергана")],
    ['Qarshi', cityRe('qarshi|karshi|карши|қарши')],
    ['Nukus', cityRe('nukus|нукус')],
    ['Urgench', cityRe('urgench|urganch|ургенч|урганч')],
    ['Khiva', cityRe('khiva|xiva|хива')],
  ],
  UA: [
    ['Kyiv', cityRe('kyiv|kiev|київ|киев')],
    ['Kharkiv', cityRe('kharkiv|kharkov|харків|харьков')],
    ['Odesa', cityRe('odesa|odessa|одеса|одесса')],
    ['Dnipro', cityRe('dnipro|дніпро|днепр')],
    ['Lviv', cityRe('lviv|львів|львов')],
    ['Vinnytsia', cityRe('vinnytsia|vinnitsa|вінниця|винница')],
    ['Zaporizhzhia', cityRe('zaporizhzhia|zaporozhye|запоріжжя|запорожье')],
  ],
  KZ: [
    ['Almaty', cityRe('almaty|алматы')],
    ['Astana', cityRe('astana|астана')],
    ['Shymkent', cityRe('shymkent|chimkent|шымкент|чимкент')],
    ['Karaganda', cityRe('karaganda|караганда')],
    ['Atyrau', cityRe('atyrau|атырау')],
    ['Aktobe', cityRe('aktobe|актобе')],
  ],
  KG: [
    ['Bishkek', cityRe('bishkek|бишкек')],
    ['Osh', cityRe('osh|ош')],
    ['Karakol', cityRe('karakol|каракол')],
  ],
}

const TASHKENT_DISTRICTS: Array<[string, RegExp]> = [
  ['Chilanzar', cityRe('chilanzar|chilonzor|чиланзар|чилонзор')],
  ['Yunusabad', cityRe('yunusabad|yunusobod|юнасабад|юнусобод')],
  ['Mirabad', cityRe('mirabad|mirobod|мирабад|миробод')],
  ['Yakkasaray', cityRe('yakkasaray|yakkasaroy|яккасарай|яккасарой')],
  ['Shaykhantahur', cityRe('shaykhantahur|shayxontohur|шейхантахур|шайхонтохур')],
  ['Mirzo Ulugbek', cityRe("mirzo\\s+ulugbek|mirzo\\s+ulug(?:'|’)bek|мирзо\\s+улугбек")],
  ['Uchtepa', cityRe('uchtepa|учтепа')],
  ['Sergeli', cityRe('sergeli|сергели')],
  ['Bektemir', cityRe('bektemir|бектемир')],
  ['Almazar', cityRe('almazar|olmazor|алмазар|олмазор')],
  ['Yashnabad', cityRe('yashnabad|yashnobod|яшнабад|яшнобод')],
]

function telegramCountry(value: string): HiringTelegramChannelDescriptor['country'] {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'UA' || normalized === 'KZ' || normalized === 'KG') return normalized
  return 'UZ'
}

function telegramChannels(): TelegramChannel[] {
  const raw = process.env.HIRING_TELEGRAM_CHANNELS
  if (!raw?.trim()) {
    return HIRING_TELEGRAM_CHANNELS.map((channel) => ({
      ...channel,
      tags: [...channel.tags],
      includeAny: channel.includeAny ? [...channel.includeAny] : undefined,
    }))
  }
  return raw.split(',').map((entry) => {
    const [handle = '', label = '', country = 'UZ'] = entry.split(':').map((part) => part.trim())
    const normalizedCountry = telegramCountry(country)
    return {
      handle,
      label: label || handle,
      country: normalizedCountry,
      location: label || country,
      tags: ['Resume'],
      cvFeed: true,
      requireCandidateMarker: normalizedCountry === 'UZ',
      historyLimit: normalizedCountry === 'UZ' ? 2_000 : 1_500,
    }
  }).filter((channel) => channel.handle)
}

function telegramHistoryLimit(channel: TelegramChannel): number {
  const requested = Number(process.env.HIRING_TELEGRAM_HISTORY_LIMIT || DEFAULT_HISTORY_LIMIT)
  const envLimit = Number.isFinite(requested) ? requested : DEFAULT_HISTORY_LIMIT
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
  /(?:#(?:ищу[_-]?(?:работу|подработку)|ищуработу|шукаю[_-]?(?:роботу|підробіток)|шукаюроботу|кандидат(?:ка)?|резюме|resume|cv|ish[_-]?kerak|ish[_-]?izlayapman|menga[_-]?ish[_-]?kerak)|#ищу\s+#работу|#ish\s+#qidir(?:yapman|aman)|(?<![\p{L}\p{N}])(?:ищу|шукаю)\s+(?:себе\s+)?(?:работу|подработку|роботу|підробіток)|(?<![\p{L}\p{N}])(?:работу\s+ищу|нужна\s+(?:мне\s+)?работа|могу\s+работать)|(?<![\p{L}\p{N}])(?:у\s+пошуках?\s+роботи|у\s+пошуку\s+роботи|розглядаю\s+пропозиції|нахожусь\s+в\s+поиске\s+работы|в\s+поиске\s+работы)|\b(?:menga\s+ish\s+kerak|ish\s+(?:joyi\s+)?kerak|ish\s+(?:izlayapman|qidiryapman|qidiraman))|\b(?:looking\s+for\s+(?:a\s+)?(?:job|work|opportunit(?:y|ies))|open\s+to\s+work))/iu
const CV_MARKER_RE = /(?:резюме|resume|\bcv\b|curriculum vitae|анкета|профиль кандидата|профіль кандидата|кандидат(?:ка)?|candidate profile|mening\s+(?:cv|rezume)|my\s+cv)/iu
const FIRST_PERSON_RE = /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,6}(?:я[\s—,-]|я\s+(?:ищу|шукаю)|men[\s,]|mening[\s,]|my name is|i am a|i'm a|ismim\b)/iu
const EMPLOYER_RE = /(?:we(?:'re| are)\s+(?:hiring|looking\s+for)|(?:^|\n)\s*[^\p{L}\p{N}\n]{0,10}(?:ищем|требуется|требуются|вакансия|компания\s+ищет|шукаємо|потрібен|потрібна|потрібні|вакансія|запрошуємо|hiring|vacancy|ishchi\s+kerak|xodim\s+kerak|ishga\s+(?:taklif|qabul)|bo(?:'|’)sh\s+ish\s+o(?:'|’)rni))/iu
const VACANCY_SECTION_RE = /(?:requirements?|responsibilit|qualifications?|обязанност|требован|условия\s+работ|мы\s+предлагаем|обов(?:'|’)язк|вимог|ми\s+пропонуємо|what we offer|надсилайте\s+резюме|присылайте\s+резюме|(?:^|\n)\s*(?:talablar|vazifalar)\s*[:—-]|biz\s+taklif\s+qilamiz)/imu
const ROLE_RE = /\b(?:developer|engineer|designer|manager|analyst|specialist|qa|tester|devops|frontend|backend|accountant|cashier|seller|driver|builder|welder|cleaner|waiter|cook|guard|courier|teacher|tutor|nanny|nurse|doctor|dentist|pharmacist|bartender|barista|trainer|coach|administrator|director|supervisor|receptionist|hostess|promoter|packer|marketer|marketing|lawyer|economist|logistician|recruiter|programmer|operator|storekeeper|loader|electrician|plumber|painter|hairdresser|seamstress|baker|florist|realtor|copywriter|translator|secretary|mechanic|agronomist|sysadmin|smm)\b|разработ|инженер|інженер|дизайнер|менеджер|аналитик|аналітик|специалист|спеціаліст|бухгалтер|кассир|касир|продав|водител|водій|строит|будівел|сварщик|зварюваль|убор|прибирал|официант|офіціант|бармен|бариста|повар|кухар|охран|охорон|управляющ|керівник|директор|администратор|адміністратор|супервайзер|курьер|кур'єр|учител|вчител|преподав|викладач|репетитор|воспитател|виховател|нян|врач|лікар|стоматолог|фармацевт|медсестр|медбрат|тренер|рецепционист|рецепціоніст|хостес|промоутер|упаковщик|dasturchi|menejer|buxgalter|kassir|sotuvchi|haydovchi|shafyor|qurilish|payvandchi|farrosh|afitsant|barmen|oshpaz|qorovul|boshqaruv|kuryer|o['’ʻʼ‘`]?qituvchi(?:lik)?|repetitor|tarbiyachi|enaga|shifokor|hamshira|маркетолог|таргетолог|програміст|программист|юрист|економіст|экономист|логіст|логист|рекрут|кадров|оператор|комірник|кладовщик|вантажник|грузчик|слесар|слюсар|электрик|електрик|сантехник|сантехнік|маляр|штукатур|плиточник|перукар|парикмахер|масажист|массажист|косметолог|манікюр|маникюр|швея|кравец|портн|кондитер|пекар|пекарь|флорист|ріелтор|риелтор|риэлтор|копірайтер|копирайтер|перекладач|переводчик|секретар|токар|фрезеров|механик|механік|агроном|швачк|sartarosh|tikuvchi|elektrik|santexnik|yuk\s+ortuvchi|marketolog|kassa\s+(?:xodimi|mudiri)|b(?:u(?:x|h)?|o)?galter(?:iya)?|notarius|metrologiya|operatorlik/iu
const CONTACT_RE = /(?:\+?\d[\d\s()\-]{7,}|@[a-z0-9_]{4,}|(?:telegram|телефон|phone|tel|aloqa|murojaat|bog(?:'|’)lanish)\s*[:—-])/iu
const PROMOTION_RE = /t\.me\/addlist\b|(?:telegram[- ]?)?канал\w*\s+(?:в\s+)?(?:одн\w+\s+)?папк|добав(?:ить|ьте)\s+(?:свой\s+)?канал|happy\s+monday\s+оновил\p{L}*\s+функционал|залиште\s+відгук\s+на\s+happy\s+monday|відгук\p{L}*\s+про\s+роботодавц|(?:women\s+)?career\s+day|кар['’]єрн\p{L}*\s+поді\p{L}*|придбати\s+квитки|добірк\p{L}*\s+новин|отримувати\s+такі\s+новини\s+щотижня/iu

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
  if (/^(?:колеги[,!\s]*)?(?:вітаю[,!\s]*)?рекомендую\s+(?:класного\s+)?кандидат\p{L}*[.!\s]+(?:контакт\p{L}*\s+та\s+)?резюме\s+додаю\.?$/iu.test(compact)) return false

  const explicitIntent = CANDIDATE_INTENT_RE.test(value)
  const candidateForm = CANDIDATE_FORM_RE.test(value)
  if (EMPLOYER_RE.test(value) || UZ_EMPLOYER_RE.test(value) || VACANCY_SECTION_RE.test(value)) return false
  if (!explicitIntent && !candidateForm && isLikelyTelegramVacancy(compact)) return false

  const hasCvMarker = CV_MARKER_RE.test(value)
  const firstPerson = FIRST_PERSON_RE.test(value)
  const hasRole = ROLE_RE.test(value)
  const hasContact = CONTACT_RE.test(value)
  const sections = cvSectionCount(value)
  const hasExperience = /(?:\d+\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)|(?:опыт|досвід|experience|staj|tajriba)\s*[:—-]?\s*\d)/iu.test(value)

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
  const halfYears = text.match(/(?:ish\s+staji|staj|tajriba\p{L}*)\s*[:—-]?\s*(\d+)\s+yarim\s+yil/iu)
  if (halfYears?.[1]) return Number(halfYears[1]) + 0.5
  const match = text.match(/(?:опыт|досвід|experience|staj|tajriba\p{L}*)\s*[:—-]?\s*(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)?/iu)
    || text.match(/(\d+)\+?\s*(?:лет|рок(?:и|ів)?|years|yil|йил)\s+(?:опыт\p{L}*|досвід\p{L}*|experience|tajriba\p{L}*|staj\p{L}*)/iu)
    || text.match(/(?:опыт|досвід|experience|staj|tajriba)\p{L}*\s+(?:работы|роботи|of\s+work)?\s*[:—-]?\s*(\d+)/iu)
  const years = match ? Number(match[1]) : undefined
  if (!Number.isFinite(years)) return undefined
  return years > 0 && years <= MAX_PLAUSIBLE_EXPERIENCE_YEARS ? years : undefined
}

function parseName(text: string): string {
  return extractCandidateName(text)
}

function parseRole(text: string): string {
  const targetNames = 'желаемая (?:работа|должность)|бажана (?:робота|посада)|ожидаемая работа|ищу работу|шукаю роботу|ish kerak|menga ish kerak|ish joyi kerak|qidirayotgan kasb|so(?:\'|’|ʻ|ʼ|‘)ralgan ish (?:joyi|turi)|soha|position|role|должность|позиция|посада|lavozim|kasb(?:i|im)?|mutaxassislik|specialization|специализация|target role'
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

export function detectCity(text: string, country: string): string | null {
  for (const [city, pattern] of CITY_ALIASES[country] || []) {
    if (pattern.test(text)) return city
  }
  return null
}

function fallbackChannelCity(channel: TelegramChannel): string | null {
  return (CITY_ALIASES[channel.country] || []).some(([city]) => city === channel.location) ? channel.location : null
}

export function detectDistrict(text: string, city: string | null): string | null {
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
  const localToChannel = !channel.includeAny?.length
    || channel.includeAny.some((marker) => lowerText.includes(marker.toLocaleLowerCase('ru')))
  if (channel.requireCandidateMarker && !UZ_CANDIDATE_MARKER_RE.test(text)) return null
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = parseName(text)
  const role = parseRole(text)
  const skills = parseSkills(text)
  if (needle && !`${name} ${role} ${text} ${skills.join(' ')}`.toLocaleLowerCase('ru').includes(needle)) return null

  const explicitLocation = field(text, 'location|city|локация|локація|город|місто|shahar|yashash (?:manzili|joyi)|hozirgi manzil|manzil|hudud')
  const explicitCity = explicitLocation ? detectCity(explicitLocation, channel.country) || explicitLocation : null
  const city = localToChannel
    ? explicitCity || detectCity(text, channel.country) || fallbackChannelCity(channel)
    : explicitCity || null
  const district = detectDistrict(text, city)
  const contact = field(text, 'contact|контакт|telegram|phone|телефон|tel|telefon|boglanish|aloqa|murojaat')
  const employmentType = field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')
  const education = field(text, "education|образование|освіта|o['’]qish|ta['’]lim|ma['’]lumoti|diplom") || blockAfter(text, "education|образование|освіта|o['’]qish|ta['’]lim|ma['’]lumoti|diplom") || null
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((match) => match[1]!)
  const salary = parseSalary(text, channel.country)

  return {
    id: opts.id,
    source: 'telegram',
    sourceCountry: channel.country,
    country: localToChannel ? channel.country : '',
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

interface MessageOutcome {
  profile: CvProfile | null
  candidateMarker: boolean
  reason?: 'expired' | 'vacancy' | 'quality'
}

function looksLikeVacancy(text: string): boolean {
  const value = text.replace(/\s+/g, ' ')
  return EMPLOYER_RE.test(text) || VACANCY_SECTION_RE.test(text) || isLikelyTelegramVacancy(value)
}

function classifyMessage(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramChannel,
  needle: string,
): MessageOutcome {
  const candidateMarker = UZ_CANDIDATE_MARKER_RE.test(text)
  if (!recentCandidateDate(opts.dateIso)) return { profile: null, candidateMarker, reason: 'expired' }

  const profile = messageToProfile(text, opts, channel, needle)
  if (profile) return { profile, candidateMarker }
  return { profile: null, candidateMarker, reason: looksLikeVacancy(text) ? 'vacancy' : 'quality' }
}

interface PageRequest {
  afterId?: number
  beforeId?: number
  limit: number
}

interface PageResult {
  profiles: CvProfile[]
  funnel: ChannelFunnel
  newestId: number
  oldestId: number
  more: boolean
  reachedCutoff: boolean
}

function emptyPage(): PageResult {
  return { profiles: [], funnel: emptyFunnel(), newestId: 0, oldestId: 0, more: false, reachedCutoff: false }
}

async function fetchWorkerPage(
  base: string,
  channel: TelegramChannel,
  q: string,
  request: PageRequest,
): Promise<PageResult> {
  const needle = q.trim().toLocaleLowerCase('ru')
  const params = new URLSearchParams({ channel: channel.handle, limit: String(request.limit) })
  if (request.beforeId && request.beforeId > 0) params.set('beforeId', String(request.beforeId))

  const res = await fetch(`${base.replace(/\/+$/, '')}/history?${params}`, {
    signal: AbortSignal.timeout(TELEGRAM_WORKER_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`tg-worker @${channel.handle} -> ${res.status}`)
  const data = (await res.json()) as TelegramWorkerHistory
  if (!data.ok || !Array.isArray(data.messages)) throw new Error(`tg-worker @${channel.handle} bad payload`)

  const page = emptyPage()
  if (!data.messages.length) return page

  const cutoff = candidateCutoff()
  const ids: number[] = []
  let oldestDate = Number.POSITIVE_INFINITY

  for (const message of data.messages) {
    if (request.afterId && Number(message.id) <= request.afterId) {
      page.more = false
      break
    }
    if (Number.isFinite(message.id)) ids.push(Number(message.id))

    const text = [(message.text || '').trim(), (message.preview || '').trim()].filter(Boolean).join('\n')
    if (!text) continue
    page.funnel.fetched += 1

    if (message.date) {
      const stamp = Date.parse(message.date)
      if (Number.isFinite(stamp)) oldestDate = Math.min(oldestDate, stamp)
    }

    const outcome = classifyMessage(text, {
      id: `telegram-${channel.handle}-${message.id}`,
      url: `https://t.me/${channel.handle}/${message.id}`,
      dateIso: message.date,
    }, channel, needle)

    if (outcome.candidateMarker) page.funnel.candidateMarkerMatched += 1
    if (outcome.reason === 'vacancy') page.funnel.rejectedVacancy += 1
    else if (outcome.reason === 'quality') page.funnel.rejectedQuality += 1
    if (outcome.profile) {
      page.profiles.push(outcome.profile)
      page.funnel.candidates += 1
    }
  }

  if (ids.length) {
    page.newestId = Math.max(...ids)
    page.oldestId = Math.min(...ids)
  }
  page.reachedCutoff = Number.isFinite(oldestDate) && oldestDate < cutoff
  page.more = !page.reachedCutoff && data.messages.length >= request.limit
  return page
}

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
  cursor: ChannelCursor
}

async function crawlChannel(
  base: string,
  channel: TelegramChannel,
  q: string,
  cursor: ChannelCursor,
): Promise<{ profiles: CvProfile[]; funnel: ChannelFunnel; cursor: ChannelCursor; mode: 'incremental' | 'backfill' | 'idle' }> {
  const funnel = emptyFunnel()
  const profiles: CvProfile[] = []
  let next: ChannelCursor = { ...cursor }
  let mode: 'incremental' | 'backfill' | 'idle' = 'idle'

  const incremental = await fetchWorkerPage(base, channel, q, {
    afterId: cursor.newestMessageId || undefined,
    limit: TELEGRAM_PAGE_SIZE,
  })
  if (incremental.funnel.fetched > 0) mode = 'incremental'
  profiles.push(...incremental.profiles)
  addFunnel(funnel, incremental.funnel)
  if (incremental.newestId) next.newestMessageId = Math.max(next.newestMessageId, incremental.newestId)
  if (!next.oldestMessageId && incremental.oldestId) next.oldestMessageId = incremental.oldestId

  if (!next.bootstrapComplete && next.oldestMessageId) {
    const backfill = await fetchWorkerPage(base, channel, q, {
      beforeId: next.oldestMessageId,
      limit: TELEGRAM_PAGE_SIZE,
    })
    if (backfill.funnel.fetched > 0 && mode === 'idle') mode = 'backfill'
    profiles.push(...backfill.profiles)
    addFunnel(funnel, backfill.funnel)
    if (backfill.oldestId) next.oldestMessageId = Math.min(next.oldestMessageId, backfill.oldestId)
    if (backfill.reachedCutoff || !backfill.more || !backfill.oldestId) next.bootstrapComplete = true
  } else if (!next.oldestMessageId && !incremental.more) {
    next.bootstrapComplete = true
  }

  next.lastSuccessAt = new Date().toISOString()
  return { profiles, funnel, cursor: next, mode }
}

function addFunnel(total: ChannelFunnel, page: ChannelFunnel): void {
  total.fetched += page.fetched
  total.candidateMarkerMatched += page.candidateMarkerMatched
  total.rejectedVacancy += page.rejectedVacancy
  total.rejectedQuality += page.rejectedQuality
  total.candidates += page.candidates
}

async function readChannel(channel: TelegramChannel, q: string, cursor: ChannelCursor): Promise<ChannelOutcome> {
  const checkedAt = new Date().toISOString()
  const startedAt = Date.now()
  const workerUrl = process.env.TELEGRAM_WORKER_URL

  try {
    if (!workerUrl) {
      const result = await fetchTelegramChannel(channel, q)
      return {
        result,
        cursor,
        diagnostic: {
          handle: channel.handle,
          country: channel.country,
          status: result.profiles.length ? 'ok' : 'empty',
          fetched: result.fetched,
          candidateMarkerMatched: 0,
          rejectedVacancy: 0,
          rejectedQuality: Math.max(0, result.fetched - result.profiles.length),
          candidates: result.profiles.length,
          mode: 'incremental',
          newestMessageId: cursor.newestMessageId,
          oldestMessageId: cursor.oldestMessageId,
          bootstrapComplete: cursor.bootstrapComplete,
          fetchDurationMs: Date.now() - startedAt,
          checkedAt,
        },
      }
    }

    const round = await crawlChannel(workerUrl, channel, q, cursor)
    await saveCursor(round.cursor)
    return {
      result: { profiles: round.profiles, fetched: round.funnel.fetched },
      cursor: round.cursor,
      diagnostic: {
        handle: channel.handle,
        country: channel.country,
        status: round.profiles.length ? 'ok' : 'empty',
        fetched: round.funnel.fetched,
        candidateMarkerMatched: round.funnel.candidateMarkerMatched,
        rejectedVacancy: round.funnel.rejectedVacancy,
        rejectedQuality: round.funnel.rejectedQuality,
        candidates: round.funnel.candidates,
        mode: round.mode,
        newestMessageId: round.cursor.newestMessageId,
        oldestMessageId: round.cursor.oldestMessageId,
        bootstrapComplete: round.cursor.bootstrapComplete,
        fetchDurationMs: Date.now() - startedAt,
        checkedAt,
      },
    }
  } catch (err) {
    const error = (err as Error).message
    console.error(`[hiring] telegram @${channel.handle} failed:`, error)
    return {
      result: { profiles: [], fetched: 0 },
      cursor,
      diagnostic: {
        handle: channel.handle,
        country: channel.country,
        status: 'error',
        fetched: 0,
        candidateMarkerMatched: 0,
        rejectedVacancy: 0,
        rejectedQuality: 0,
        candidates: 0,
        mode: 'idle',
        newestMessageId: cursor.newestMessageId,
        oldestMessageId: cursor.oldestMessageId,
        bootstrapComplete: cursor.bootstrapComplete,
        fetchDurationMs: Date.now() - startedAt,
        checkedAt,
        error,
      },
    }
  }
}

/** Configured handles, in fetch order — the queue scheduler fans these out. */
export function hiringChannelHandles(): string[] {
  return telegramChannels()
    .filter((channel) => channel.enabled !== false)
    .map((channel) => channel.handle)
}

/** Refresh one configured Telegram channel for the per-channel queue task. */
export async function fetchHiringChannel(handle: string, q = ''): Promise<ChannelOutcome | null> {
  if (process.env.TELEGRAM_SOURCE === 'off') return null
  const wanted = handle.replace(/^@/, '').toLowerCase()
  const channel = telegramChannels().find(
    (item) => item.enabled !== false && item.handle.toLowerCase() === wanted,
  )
  if (!channel) return null

  const cursors = await loadCursors()
  const outcome = await readChannel(channel, q, cursors.get(channel.handle) || emptyCursor(channel.handle))
  const index = telegramDiagnostics.findIndex((item) => item.handle.toLowerCase() === wanted)
  if (index >= 0) telegramDiagnostics[index] = outcome.diagnostic
  else telegramDiagnostics = [...telegramDiagnostics, outcome.diagnostic]
  return outcome
}

export function getHiringSourceDiagnostics(): HiringSourceDiagnostic[] {
  return telegramDiagnostics.map((item) => ({ ...item }))
}
