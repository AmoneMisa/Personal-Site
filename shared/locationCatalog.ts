import { CITIES as PARSING_CITIES, aliasesOf } from '@whiteslove/parsing-lexicon/geo'
import { HIRING_COUNTRIES } from './hiring/hiringMarkets'

export const CITY_LABELS_RU: Record<string, string> = {
  Tashkent: 'Ташкент', Samarkand: 'Самарканд', Bukhara: 'Бухара', Namangan: 'Наманган',
  Andijan: 'Андижан', Fergana: 'Фергана', Nukus: 'Нукус', Navoi: 'Навои', Navoiy: 'Навои', Jizzakh: 'Джизак',
  Termez: 'Термез', Qarshi: 'Карши', Urgench: 'Ургенч', Gulistan: 'Гулистан', Chirchiq: 'Чирчик',
  'Tashkent Region': 'Ташкентская область', Karakalpakstan: 'Каракалпакстан', Kashkadarya: 'Кашкадарья',
  Surkhandarya: 'Сурхандарья', Syrdarya: 'Сырдарья', Khorezm: 'Хорезм',
  Almaty: 'Алматы', Astana: 'Астана', Shymkent: 'Шымкент', Karaganda: 'Караганда',
  Aktobe: 'Актобе', Atyrau: 'Атырау', Oral: 'Уральск', Taraz: 'Тараз', Pavlodar: 'Павлодар',
  Semey: 'Семей', Kostanay: 'Костанай', Kyzylorda: 'Кызылорда', Aktau: 'Актау',
  Kyiv: 'Киев', Lviv: 'Львов', Odesa: 'Одесса', Kharkiv: 'Харьков', Dnipro: 'Днепр',
  Vinnytsia: 'Винница', 'Ivano-Frankivsk': 'Ивано-Франковск', Lutsk: 'Луцк', Chernivtsi: 'Черновцы',
  Zaporizhzhia: 'Запорожье', Poltava: 'Полтава', Rivne: 'Ровно', Ternopil: 'Тернополь',
  Uzhhorod: 'Ужгород', Khmelnytskyi: 'Хмельницкий', Zhytomyr: 'Житомир', Cherkasy: 'Черкассы',
  Chernihiv: 'Чернигов', Sumy: 'Сумы', Mykolaiv: 'Николаев', Kropyvnytskyi: 'Кропивницкий',
  Bucharest: 'Бухарест', 'Cluj-Napoca': 'Клуж-Напока', Timisoara: 'Тимишоара',
  Iasi: 'Яссы', Brasov: 'Брашов', Constanta: 'Констанца', Oradea: 'Орадя',
}

const SHARED_CITY_ALIASES: Record<string, string[]> = Object.fromEntries(
  PARSING_CITIES.map((city) => [normalizeCityValue(city.canonical), aliasesOf(city)]),
)

const CITY_ALIASES: Record<string, string[]> = {
  kyiv: ['kyiv', 'kiev', 'киев', 'київ'],
  lviv: ['lviv', 'львов', 'львів'],
  odesa: ['odesa', 'odessa', 'одесса', 'одеса'],
  kharkiv: ['kharkiv', 'kharkov', 'харьков', 'харків'],
  dnipro: ['dnipro', 'днепр', 'дніпро'],
  vinnytsia: ['vinnytsia', 'vinnitsa', 'винница', 'вінниця'],
  zaporizhzhia: ['zaporizhzhia', 'zaporozhye', 'запорожье', 'запоріжжя'],
  bishkek: ['bishkek', 'бишкек'],
  osh: ['osh', 'ош'],
  karakol: ['karakol', 'каракол'],
  bucharest: ['bucharest', 'bucuresti', 'bucurești', 'бухарест'],
  'cluj-napoca': ['cluj-napoca', 'cluj napoca', 'cluj', 'клуж-напока', 'клуж'],
  iasi: ['iasi', 'iași', 'яссы'],
  timisoara: ['timisoara', 'timișoara', 'тимишоара'],
  brasov: ['brasov', 'brașov', 'брашов'],
  ...SHARED_CITY_ALIASES,
}

const CITY_LABELS = new Map(
  [...Object.keys(CITY_LABELS_RU), ...HIRING_COUNTRIES.flatMap((country) => country.cities || [])]
    .map((city) => [normalizeCityValue(city), city] as const),
)
const LOCALIZED_CITY_KEYS = new Map(
  Object.entries(CITY_LABELS_RU).map(([city, label]) => [normalizeCityValue(label), normalizeCityValue(city)]),
)

export function normalizeCityValue(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

export function canonicalCityKey(value: string): string {
  const normalized = normalizeCityValue(value)
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((alias) => normalizeCityValue(alias) === normalized)) return canonical
  }
  return LOCALIZED_CITY_KEYS.get(normalized) || normalized
}

export function cityAliases(value: string): string[] {
  return CITY_ALIASES[canonicalCityKey(value)] || [value]
}

export function canonicalCityValue(value: string): string {
  const canonical = canonicalCityKey(value)
  return CITY_LABELS.get(canonical) || value.trim()
}

export function cityDisplayLabel(value: string, locale: string): string {
  const canonical = canonicalCityValue(value)
  return locale.toLowerCase().startsWith('ru') ? CITY_LABELS_RU[canonical] || canonical : canonical
}
