// Localized display names for locations (countries, cities, districts, metro stations).
//
// Canonical values stay canonical everywhere they matter — listing fields, filter
// state, URL params and API requests — and are translated only at render time.
// A value with no entry falls through unchanged, so this is safe to apply to any
// string (including one that is already localized, or a name we don't know yet).
import { cityDisplayLabel } from "~~/shared/locationCatalog";

const DISTRICT_RU: Record<string, string> = {
  // Tashkent
  Chilanzar: 'Чиланзар', Yunusabad: 'Юнусабад', 'Mirzo Ulugbek': 'Мирзо-Улугбек',
  Yakkasaray: 'Яккасарай', Shaykhantahur: 'Шайхантахур', Yashnobod: 'Яшнабад',
  Sergeli: 'Сергели', Uchtepa: 'Учтепа', Mirobod: 'Мирабад', Bektemir: 'Бектемир',
  Olmazor: 'Алмазар',
  // Almaty
  Almaly: 'Алмалинский', Bostandyk: 'Бостандыкский', Medeu: 'Медеуский',
  Auezov: 'Ауэзовский', Turksib: 'Турксибский', Nauryzbay: 'Наурызбайский',
  Alatau: 'Алатауский', Zhetysu: 'Жетысуский',
  // Kyiv
  Podil: 'Подол', Pechersk: 'Печерск', Obolon: 'Оболонь', Shevchenkivskyi: 'Шевченковский',
  Solomianskyi: 'Соломенский', Darnytskyi: 'Дарницкий', Holosiivskyi: 'Голосеевский',
  Dniprovskyi: 'Днепровский', Sviatoshynskyi: 'Святошинский', Desnianskyi: 'Деснянский',
  // Bucharest
  Pipera: 'Пипера', Militari: 'Милитари', 'Drumul Taberei': 'Друмул Таберей',
  Titan: 'Титан', Berceni: 'Берчень', Floreasca: 'Флоряска', Dorobanti: 'Доробанць',
  Cotroceni: 'Котрочень',
};

// Tashkent metro. The backend/meta route may already hand us a localized label,
// in which case the lookup simply misses and the value passes through.
const METRO_RU: Record<string, string> = {
  'Buyuk Ipak Yoli': 'Буюк Ипак Йули', Pushkin: 'Пушкин', 'Hamid Olimjon': 'Хамид Алимджан',
  'Amir Temur Xiyoboni': 'Амир Темур Хиёбони', 'Mustaqillik Maydoni': 'Мустакиллик майдони',
  Paxtakor: 'Пахтакор', 'Xalqlar Dostligi': 'Халклар Дустлиги', 'Milliy Bog': 'Миллий Бог',
  Novza: 'Новза', 'Mirzo Ulugbek': 'Мирзо Улугбек', Chilonzor: 'Чиланзар', Olmazor: 'Алмазар',
  Choshtepa: 'Чаштепа', Ozgarish: 'Узгариш', Sergeli: 'Сергели', Yangihayot: 'Янгихаёт',
  Chinor: 'Чинар', Beruniy: 'Беруни', Tinchlik: 'Тинчлик', Chorsu: 'Чорсу',
  'Gafur Gulom': 'Гафур Гулям', 'Alisher Navoi': 'Алишер Навои', Ozbekiston: 'Узбекистан',
  Kosmonavtlar: 'Космонавтлар', Oybek: 'Ойбек', Toshkent: 'Ташкент',
  Mashinasozlar: 'Машинасозлар', Dostlik: 'Дустлик', Turkiston: 'Туркистон',
  Yunusobod: 'Юнусабад', Shahriston: 'Шахристан', Bodomzor: 'Бадамзар', Minor: 'Минор',
  'Abdulla Qodiriy': 'Абдулла Кадыри', 'Yunus Rajabiy': 'Юнус Раджаби', 'Ming Orik': 'Мингурик',
  Texnopark: 'Технопарк', Yashnobod: 'Яшнабад', Tuzel: 'Тузель', Olmos: 'Алмас',
  Rohat: 'Рохат', Yangiobod: 'Янгиабад', Qoyliq: 'Куйлюк', Matonat: 'Матонат',
  Qiyot: 'Кият', Tolariq: 'Толарык', Xonobod: 'Хонабад', Quruvchilar: 'Курувчилар',
  Turon: 'Туран', Qipchoq: 'Кипчак',
};

// A second name people still use for a station: the Soviet-era name it was
// renamed from, or — where the Uzbek name is a phrase rather than a proper
// noun — what it means. Historic names are taken from OSM's old_name tag
// rather than memory; stations OSM does not record are simply absent.
const METRO_ALIAS_RU: Record<string, string> = {
  'Buyuk Ipak Yoli': 'Максим Горький',
  Novza: 'Хамза',
  'Amir Temur Xiyoboni': 'Сквер Октябрьской Революции',
  'Mustaqillik Maydoni': 'Площадь Ленина',
  'Milliy Bog': 'Национальный парк',
  Yunusobod: 'Фахрийлар чойхонаси',
  'Xalqlar Dostligi': 'Дружба народов',
  Ozbekiston: 'Узбекистан',
  Mashinasozlar: 'Машиностроителей',
  Dostlik: 'Дружба',
  Tinchlik: 'Мир',
};

/** Alias in parentheses when the station carries one: "Новза (Хамза)". */
export function metroLabelWithAlias(value: string | null | undefined, locale: string): string {
  const label = locationLabel(value, locale, 'metro');
  if (!value || !locale.toLowerCase().startsWith('ru')) return label;
  const alias = METRO_ALIAS_RU[value];
  return alias && alias !== label ? `${label} (${alias})` : label;
}

export type LocationKind = 'country' | 'city' | 'district' | 'metro' | 'any';

const MAPS: Record<Exclude<LocationKind, 'any' | 'country' | 'city'>, Record<string, string>> = {
  district: DISTRICT_RU,
  metro: METRO_RU,
};

function countryDisplayLabel(value: string, locale: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return value;
  try {
    return new Intl.DisplayNames([locale || 'en'], { type: 'region' }).of(code) || value;
  } catch {
    return value;
  }
}

// Translate a canonical location name for display. Unknown values (and values
// already in the target language) are returned unchanged.
export function locationLabel(value: string | null | undefined, locale: string, kind: LocationKind = 'any'): string {
  if (!value) return '';
  if (kind === 'country') return countryDisplayLabel(value, locale);
  if (kind === 'city') return cityDisplayLabel(value, locale);
  if (!locale.toLowerCase().startsWith('ru')) return value;
  if (kind !== 'any') return MAPS[kind]?.[value] || value;
  const city = cityDisplayLabel(value, locale);
  return city !== value ? city : DISTRICT_RU[value] || METRO_RU[value] || value;
}
