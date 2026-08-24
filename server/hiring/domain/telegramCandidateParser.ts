import type { CvProfile } from '../../../shared/contracts/hiring'
import type { HiringTelegramChannelDescriptor } from '../../../shared/hiring/sources/telegramChannels'
import { extractCandidateName } from '../../utils/hiringCandidateFields'
import { cityRe } from '../../utils/hiringWebFields'
import { isLikelyTelegramVacancy } from '../../utils/sources'

export type TelegramCandidateChannel = HiringTelegramChannelDescriptor

export interface TelegramMessageOutcome {
  profile: CvProfile | null
  candidateMarker: boolean
  reason?: 'expired' | 'vacancy' | 'quality'
}

const MAX_CANDIDATE_AGE_MONTHS = 3
const FUTURE_DATE_TOLERANCE_MS = 48 * 60 * 60 * 1000

const UZ_CANDIDATE_MARKER_RE =
  /(?:#(?:ish[_-]?kerak|menga[_-]?ish[_-]?kerak|ish[_-]?izlayapman)|#ish\s+#qidir(?:yapman|aman)|\b(?:menga\s+)?ish\s+(?:joyi\s+)?kerak\b|\bish\s+(?:qidiryapman|qidiraman|izlayapman)\b|\b(?:ish|ishga)\s+joylash(?:moqchiman|ish)\b|(?:^|\n)\s*so(?:['’‘])ralgan\s+ish\s+(?:joyi|turi)\s*[:—-]|(?<![\p{L}\p{N}])(?:я\s+)?ищу\s+(?:себе\s+)?(?:работу|подработку)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])работу\s+ищу(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])нужна\s+(?:мне\s+)?работа(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])могу\s+работать(?![\p{L}\p{N}])|#ищу\s+#работу|(?<![\p{L}\p{N}])(?:у\s+пошуку|шукаю)\s+(?:роботу|підробіток)(?![\p{L}\p{N}]))/iu

const UZ_EMPLOYER_RE =
  /(?:#(?:ishchi[_-]?kerak|xodim[_-]?kerak|ishga[_-]?taklif[_-]?qilamiz|vakansiya)|\bvakansi(?:ya|я)\b|\bbo(?:'|’)sh\s+ish\s+o(?:'|’)rin(?:i|lari)\b|\bishga\s+(?:taklif\s+qilamiz|qabul\s+qilamiz|qabul\s+qilinadi|olamiz)\b|\b(?:xodim|hodim|ishchi)\s+kerak\b|\b(?:sotuvchi|kassir|operator|farrosh|afitsiant|ofitsiant|barmen|barista|oshpaz|haydovchi|qorovul|hamshira|o(?:'|’)qituvchi|administrator)\s+kerak\b|\btalab\s+(?:qilinadi|etiladi)\b|\bnomzod(?:ga|lar)?\s+.*?talab\b|\brezyume(?:ni)?\s+yubor(?:ing|ishingiz)\b)/iu

const CANDIDATE_FORM_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,8}(?:ism(?:i|im)?(?:\s*[-–—]\s*(?:familya|familiya))?|familya|familiya|f\.?i\.?o\.?|фио|имя|yoshi|yoshim|tug(?:['’‘])ilgan\s+yili|возраст|qidirayotgan\s+kasb|so(?:['’‘])ralgan\s+ish\s+(?:joyi|turi)|yashash\s+manzili|ma(?:['’‘])lumoti|ожидаемая\s+работа|желаемая\s+(?:должность|работа)|tajribasi?|опыт\s+работы)\s*[:—-]/imu

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

function field(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]\\s*([^\\n]{2,220})`, 'iu'))
  return match?.[1]?.trim()
}

function blockAfter(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]?\\s*\\n([\\s\\S]{10,800}?)(?=\\n[^\\p{L}\\p{N}\\n]{0,8}(?:experience|опыт|досвід|skills|навыки|навички|education|образован|освіта|languages|языки|мови|contact|контакт|телефон)\\s*[:—-]|$)`, 'iu'))
  return match?.[1]?.replace(/\s+/g, ' ').trim()
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
  if (!skillsLine) return []
  return [...new Set(skillsLine.split(/[,;/|•·]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 60))].slice(0, 20)
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

function fallbackChannelCity(channel: TelegramCandidateChannel): string | null {
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

export function telegramMessageToProfile(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramCandidateChannel,
  needle: string,
): CvProfile | null {
  const createdAt = recentCandidateDate(opts.dateIso)
  if (!createdAt) return null
  const lowerText = text.toLocaleLowerCase('ru')
  const localToChannel = !channel.includeAny?.length
    || channel.includeAny.some((marker) => lowerText.includes(marker.toLocaleLowerCase('ru')))
  if (channel.requireCandidateMarker && !UZ_CANDIDATE_MARKER_RE.test(text)) return null
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = extractCandidateName(text)
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

function looksLikeVacancy(text: string): boolean {
  const value = text.replace(/\s+/g, ' ')
  return EMPLOYER_RE.test(text) || VACANCY_SECTION_RE.test(text) || isLikelyTelegramVacancy(value)
}

export function classifyTelegramMessage(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramCandidateChannel,
  needle: string,
): TelegramMessageOutcome {
  const candidateMarker = UZ_CANDIDATE_MARKER_RE.test(text)
  if (!recentCandidateDate(opts.dateIso)) return { profile: null, candidateMarker, reason: 'expired' }

  const profile = telegramMessageToProfile(text, opts, channel, needle)
  if (profile) return { profile, candidateMarker }
  return { profile: null, candidateMarker, reason: looksLikeVacancy(text) ? 'vacancy' : 'quality' }
}
