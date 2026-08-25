import {
  GEOGRAPHY_CITIES,
  KZ_CITY_CATALOG,
  UA_CITY_CATALOG,
  UZ_CITY_CATALOG,
  aliasesOf,
  canonicalAnyCity,
  canonicalCentralAsiaCity,
  canonicalUkraineCity,
} from '@whiteslove/parsing-lexicon'
import { HIRING_COUNTRIES } from './hiring/hiringMarkets'

// Presentation labels only. Parser aliases live exclusively in @whiteslove/parsing-lexicon.
export const CITY_LABELS_RU: Record<string, string> = {
  Tashkent: 'Ташкент', Samarkand: 'Самарканд', Bukhara: 'Бухара', Namangan: 'Наманган',
  Andijan: 'Андижан', Fergana: 'Фергана', Nukus: 'Нукус', Navoi: 'Навои', Navoiy: 'Навои', Jizzakh: 'Джизак',
  Termez: 'Термез', Qarshi: 'Карши', Urgench: 'Ургенч', Gulistan: 'Гулистан', Chirchiq: 'Чирчик',
  'Tashkent Region': 'Ташкентская область', Karakalpakstan: 'Каракалпакстан', Kashkadarya: 'Кашкадарья',
  Surkhandarya: 'Сурхандарья', Syrdarya: 'Сырдарья', Khorezm: 'Хорезм',
  Almaty: 'Алматы', Astana: 'Астана', Shymkent: 'Шымкент', Karaganda: 'Караганда',
  Aktobe: 'Актобе', Atyrau: 'Атырау', Oral: 'Уральск', Taraz: 'Тараз', Pavlodar: 'Павлодар',
  Semey: 'Семей', Kostanay: 'Костанай', Kyzylorda: 'Кызылорда', Aktau: 'Актау', Oskemen: 'Усть-Каменогорск',
  Kyiv: 'Киев', Lviv: 'Львов', Odesa: 'Одесса', Kharkiv: 'Харьков', Dnipro: 'Днепр',
  Vinnytsia: 'Винница', 'Ivano-Frankivsk': 'Ивано-Франковск', Lutsk: 'Луцк', Chernivtsi: 'Черновцы',
  Zaporizhzhia: 'Запорожье', Poltava: 'Полтава', Rivne: 'Ровно', Ternopil: 'Тернополь',
  Uzhhorod: 'Ужгород', Khmelnytskyi: 'Хмельницкий', Zhytomyr: 'Житомир', Cherkasy: 'Черкассы',
  Chernihiv: 'Чернигов', Sumy: 'Сумы', Mykolaiv: 'Николаев', Kropyvnytskyi: 'Кропивницкий',
  Kherson: 'Херсон', 'Kryvyi Rih': 'Кривой Рог', Kremenchuk: 'Кременчуг', 'Bila Tserkva': 'Белая Церковь',
  Kamianske: 'Каменское', Vyshneve: 'Вишневое', Boryspil: 'Борисполь', Vyshhorod: 'Вышгород',
  Oleksandriia: 'Александрия', Pavlohrad: 'Павлоград', Nikopol: 'Никополь', Drohobych: 'Дрогобыч',
  Stryi: 'Стрый', Kolomyia: 'Коломыя', Kalush: 'Калуш', 'Kamianets-Podilskyi': 'Каменец-Подольский',
  Bucharest: 'Бухарест', 'Cluj-Napoca': 'Клуж-Напока', Timisoara: 'Тимишоара',
  Iasi: 'Яссы', Brasov: 'Брашов', Constanta: 'Констанца', Oradea: 'Орадя', Sibiu: 'Сибиу',
}

export function normalizeCityValue(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

const PARSING_CITIES = [
  ...GEOGRAPHY_CITIES.filter((city) => !['UA', 'KZ', 'UZ'].includes(city.country || '')),
  ...KZ_CITY_CATALOG,
  ...UZ_CITY_CATALOG,
  ...UA_CITY_CATALOG,
]
const PARSING_CITY_BY_KEY = new Map(
  PARSING_CITIES.map((city) => [normalizeCityValue(city.canonical), city] as const),
)
const CITY_LABELS = new Map(
  [...Object.keys(CITY_LABELS_RU), ...HIRING_COUNTRIES.flatMap((country) => country.cities || []), ...PARSING_CITIES.map((city) => city.canonical)]
    .map((city) => [normalizeCityValue(city), city] as const),
)
const LOCALIZED_CITY_KEYS = new Map(
  Object.entries(CITY_LABELS_RU).map(([city, label]) => [normalizeCityValue(label), normalizeCityValue(city)]),
)

function sharedCanonicalCity(value: string): string | null {
  return canonicalUkraineCity(value) || canonicalCentralAsiaCity(value) || canonicalAnyCity(value)
}

export function canonicalCityKey(value: string): string {
  const shared = sharedCanonicalCity(value)
  if (shared) return normalizeCityValue(shared)
  const normalized = normalizeCityValue(value)
  return LOCALIZED_CITY_KEYS.get(normalized) || normalized
}

export function cityAliases(value: string): string[] {
  const key = canonicalCityKey(value)
  const entity = PARSING_CITY_BY_KEY.get(key)
  return entity ? [...new Set([entity.canonical, ...aliasesOf(entity)])] : [value]
}

export function canonicalCityValue(value: string): string {
  const shared = sharedCanonicalCity(value)
  if (shared) return shared
  const canonical = canonicalCityKey(value)
  return CITY_LABELS.get(canonical) || value.trim()
}

export function cityDisplayLabel(value: string, locale: string): string {
  const canonical = canonicalCityValue(value)
  return locale.toLowerCase().startsWith('ru') ? CITY_LABELS_RU[canonical] || canonical : canonical
}
