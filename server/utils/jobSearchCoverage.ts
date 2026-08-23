export type SearchPlace = {
  country: 'UZ' | 'KZ' | 'UA' | 'RO'
  location: string
  label: string
  city?: string
  region?: string
}

export const UKRAINE_OBLASTS: SearchPlace[] = [
  ['Vinnytsia Oblast', 'Вінницька область', 'Vinnytsia'],
  ['Volyn Oblast', 'Волинська область', 'Lutsk'],
  ['Dnipropetrovsk Oblast', 'Дніпропетровська область', 'Dnipro'],
  ['Donetsk Oblast', 'Донецька область', 'Kramatorsk'],
  ['Zhytomyr Oblast', 'Житомирська область', 'Zhytomyr'],
  ['Zakarpattia Oblast', 'Закарпатська область', 'Uzhhorod'],
  ['Zaporizhzhia Oblast', 'Запорізька область', 'Zaporizhzhia'],
  ['Ivano-Frankivsk Oblast', 'Івано-Франківська область', 'Ivano-Frankivsk'],
  ['Kyiv Oblast', 'Київська область', 'Kyiv'],
  ['Kirovohrad Oblast', 'Кіровоградська область', 'Kropyvnytskyi'],
  ['Luhansk Oblast', 'Луганська область', 'Sievierodonetsk'],
  ['Lviv Oblast', 'Львівська область', 'Lviv'],
  ['Mykolaiv Oblast', 'Миколаївська область', 'Mykolaiv'],
  ['Odesa Oblast', 'Одеська область', 'Odesa'],
  ['Poltava Oblast', 'Полтавська область', 'Poltava'],
  ['Rivne Oblast', 'Рівненська область', 'Rivne'],
  ['Sumy Oblast', 'Сумська область', 'Sumy'],
  ['Ternopil Oblast', 'Тернопільська область', 'Ternopil'],
  ['Kharkiv Oblast', 'Харківська область', 'Kharkiv'],
  ['Kherson Oblast', 'Херсонська область', 'Kherson'],
  ['Khmelnytskyi Oblast', 'Хмельницька область', 'Khmelnytskyi'],
  ['Cherkasy Oblast', 'Черкаська область', 'Cherkasy'],
  ['Chernivtsi Oblast', 'Чернівецька область', 'Chernivtsi'],
  ['Chernihiv Oblast', 'Чернігівська область', 'Chernihiv'],
].map(([location, label, city]) => ({ country: 'UA', location, label, city, region: location }))

const MAJOR_CITIES: SearchPlace[] = [
  ...[
    ['Tashkent', 'Ташкент'], ['Samarkand', 'Самарканд'], ['Bukhara', 'Бухара'],
    ['Namangan', 'Наманган'], ['Andijan', 'Андижан'], ['Fergana', 'Фергана'],
    ['Qarshi', 'Карши'], ['Nukus', 'Нукус'], ['Jizzakh', 'Джизак'], ['Urgench', 'Ургенч'],
  ].map(([location, label]) => ({ country: 'UZ' as const, location, label, city: location })),
  ...[
    ['Almaty', 'Алматы'], ['Astana', 'Астана'], ['Shymkent', 'Шымкент'],
    ['Karaganda', 'Караганда'], ['Aktobe', 'Актобе'], ['Atyrau', 'Атырау'],
    ['Pavlodar', 'Павлодар'], ['Kostanay', 'Костанай'], ['Aktau', 'Актау'], ['Oskemen', 'Өскемен'],
  ].map(([location, label]) => ({ country: 'KZ' as const, location, label, city: location })),
  ...[
    ['Bucharest', 'București'], ['Cluj-Napoca', 'Cluj-Napoca'], ['Timișoara', 'Timișoara'],
    ['Iași', 'Iași'], ['Brașov', 'Brașov'], ['Constanța', 'Constanța'],
    ['Craiova', 'Craiova'], ['Sibiu', 'Sibiu'], ['Oradea', 'Oradea'], ['Ploiești', 'Ploiești'],
  ].map(([location, label]) => ({ country: 'RO' as const, location, label, city: location })),
]

export const COUNTRY_LOCATIONS: SearchPlace[] = [
  { country: 'UZ', location: 'Uzbekistan', label: 'Узбекистан' },
  { country: 'KZ', location: 'Kazakhstan', label: 'Казахстан' },
  { country: 'UA', location: 'Ukraine', label: 'Україна' },
  { country: 'RO', location: 'Romania', label: 'România' },
]

export function linkedinLocationCoverage(): SearchPlace[] {
  return [...COUNTRY_LOCATIONS, ...MAJOR_CITIES, ...UKRAINE_OBLASTS]
}

export type ThreadsJobTarget = SearchPlace & {
  key: string
  query: string
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
}

export function threadsJobCoverage(): ThreadsJobTarget[] {
  const result: ThreadsJobTarget[] = [
    { country: 'UZ', location: 'Uzbekistan', label: 'Узбекистан', query: 'Работа Узбекистан', key: 'threads-uz-country-work' },
    { country: 'UZ', location: 'Uzbekistan', label: 'Узбекистан', query: 'Вакансии Узбекистан', key: 'threads-uz-country-vacancies' },
    { country: 'KZ', location: 'Kazakhstan', label: 'Казахстан', query: 'Работа Казахстан', key: 'threads-kz-country-work' },
    { country: 'KZ', location: 'Kazakhstan', label: 'Казахстан', query: 'Вакансии Казахстан', key: 'threads-kz-country-vacancies' },
    { country: 'UA', location: 'Ukraine', label: 'Україна', query: 'Робота Україна', key: 'threads-ua-country-work' },
    { country: 'UA', location: 'Ukraine', label: 'Україна', query: 'Вакансії Україна', key: 'threads-ua-country-vacancies' },
    { country: 'RO', location: 'Romania', label: 'România', query: 'Locuri de muncă România', key: 'threads-ro-country-work' },
    { country: 'RO', location: 'Romania', label: 'România', query: 'Angajări România', key: 'threads-ro-country-hiring' },
  ]

  for (const place of MAJOR_CITIES) {
    const queries = place.country === 'RO'
      ? [`Job ${place.label}`, `Angajări ${place.label}`, `Locuri de muncă ${place.label}`]
      : place.country === 'UZ'
        ? [`Работа ${place.label}`, `Вакансии ${place.label}`, `Ish ${place.location}`, `Vakansiya ${place.location}`]
        : [`Работа ${place.label}`, `Вакансии ${place.label}`, `Жұмыс ${place.label}`]
    for (const query of queries) result.push({ ...place, query, key: `threads-${place.country.toLowerCase()}-${slug(query)}` })
  }

  for (const place of UKRAINE_OBLASTS) {
    for (const query of [`Робота ${place.label}`, `Вакансії ${place.label}`]) {
      result.push({ ...place, query, key: `threads-ua-${slug(place.location)}-${slug(query)}` })
    }
  }

  return result
}

export const REMOTE_JOB_QUERIES = [
  'remote worldwide',
  'global remote jobs',
  'work from anywhere',
  'remote Europe',
  'remote EMEA',
  'удаленная работа',
  'віддалена робота',
  'masofaviy ish',
  'қашықтан жұмыс',
]

export const USA_RELOCATION_QUERIES = [
  'relocation to USA',
  'USA relocation provided',
  'US visa sponsorship',
  'H1B sponsorship',
  'H-1B sponsorship',
  'visa sponsorship software engineer USA',
  'frontend relocation USA',
  'developer relocation USA',
]

export function rotatingSlice<T>(items: T[], maxPerCycle: number, slotMinutes = 30): T[] {
  if (items.length <= maxPerCycle) return items
  const size = Math.max(1, maxPerCycle)
  const slot = Math.floor(Date.now() / (Math.max(1, slotMinutes) * 60_000))
  const offset = (slot * size) % items.length
  return Array.from({ length: size }, (_, index) => items[(offset + index) % items.length]!)
}
