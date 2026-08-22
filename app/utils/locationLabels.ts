// Localized display names for locations (cities, districts, metro stations).
//
// Canonical values stay canonical everywhere they matter — listing fields, filter
// state, URL params and API requests — and are translated only at render time.
// A value with no entry falls through unchanged, so this is safe to apply to any
// string (including one that is already localized, or a name we don't know yet).

const CITY_RU: Record<string, string> = {
  // UZ
  Tashkent: 'Ташкент', Samarkand: 'Самарканд', Bukhara: 'Бухара', Namangan: 'Наманган',
  Andijan: 'Андижан', Fergana: 'Фергана', Nukus: 'Нукус', Navoiy: 'Навои', Jizzakh: 'Джизак',
  Termez: 'Термез', Qarshi: 'Карши', Urgench: 'Ургенч', Gulistan: 'Гулистан', Chirchiq: 'Чирчик',
  Karakalpakstan: 'Каракалпакстан', Kashkadarya: 'Кашкадарья', Surkhandarya: 'Сурхандарья',
  Syrdarya: 'Сырдарья', Khorezm: 'Хорезм',
  // KZ
  Almaty: 'Алматы', Astana: 'Астана', Shymkent: 'Шымкент', Karaganda: 'Караганда',
  Aktobe: 'Актобе', Atyrau: 'Атырау', Oral: 'Уральск', Taraz: 'Тараз', Pavlodar: 'Павлодар',
  Semey: 'Семей', Kostanay: 'Костанай', Kyzylorda: 'Кызылорда', Aktau: 'Актау',
  // UA
  Kyiv: 'Киев', Lviv: 'Львов', Odesa: 'Одесса', Kharkiv: 'Харьков', Dnipro: 'Днепр',
  Vinnytsia: 'Винница', 'Ivano-Frankivsk': 'Ивано-Франковск', Lutsk: 'Луцк',
  Chernivtsi: 'Черновцы', Zaporizhzhia: 'Запорожье', Poltava: 'Полтава', Rivne: 'Ровно',
  Ternopil: 'Тернополь', Uzhhorod: 'Ужгород', Khmelnytskyi: 'Хмельницкий',
  Zhytomyr: 'Житомир', Cherkasy: 'Черкассы', Chernihiv: 'Чернигов', Sumy: 'Сумы',
  Mykolaiv: 'Николаев', Kropyvnytskyi: 'Кропивницкий',
  // RO
  Bucharest: 'Бухарест', 'Cluj-Napoca': 'Клуж-Напока', Timisoara: 'Тимишоара',
  Iasi: 'Яссы', Brasov: 'Брашов', Constanta: 'Констанца', Oradea: 'Орадя',
};

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

export type LocationKind = 'city' | 'district' | 'metro' | 'any';

const MAPS: Record<Exclude<LocationKind, 'any'>, Record<string, string>> = {
  city: CITY_RU,
  district: DISTRICT_RU,
  metro: METRO_RU,
};

// Translate a canonical location name for display. Unknown values (and values
// already in the target language) are returned unchanged.
export function locationLabel(value: string | null | undefined, locale: string, kind: LocationKind = 'any'): string {
  if (!value) return '';
  if (!locale.toLowerCase().startsWith('ru')) return value;
  if (kind !== 'any') return MAPS[kind][value] || value;
  return CITY_RU[value] || DISTRICT_RU[value] || METRO_RU[value] || value;
}
