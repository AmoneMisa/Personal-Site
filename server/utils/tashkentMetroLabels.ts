const RU: Record<string, string> = {
  'Buyuk Ipak Yoli': 'Буюк Ипак Йули', Pushkin: 'Пушкин', 'Hamid Olimjon': 'Хамид Алимджан',
  'Amir Temur Xiyoboni': 'Амир Темур Хиёбони', 'Mustaqillik Maydoni': 'Мустакиллик майдони', Paxtakor: 'Пахтакор',
  'Xalqlar Dostligi': 'Халклар Дустлиги', 'Milliy Bog': 'Миллий Бог', Novza: 'Новза', 'Mirzo Ulugbek': 'Мирзо Улугбек',
  Chilonzor: 'Чиланзар', Olmazor: 'Алмазар', Choshtepa: 'Чаштепа', Ozgarish: 'Узгариш', Sergeli: 'Сергели', Yangihayot: 'Янгихаёт', Chinor: 'Чинар',
  Beruniy: 'Беруни', Tinchlik: 'Тинчлик', Chorsu: 'Чорсу', 'Gafur Gulom': 'Гафур Гулям', 'Alisher Navoi': 'Алишер Навои',
  Ozbekiston: 'Узбекистан', Kosmonavtlar: 'Космонавтлар', Oybek: 'Ойбек', Toshkent: 'Ташкент', Mashinasozlar: 'Машинасозлар', Dostlik: 'Дустлик',
  Turkiston: 'Туркистон', Yunusobod: 'Юнусабад', Shahriston: 'Шахристан', Bodomzor: 'Бадамзар', Minor: 'Минор',
  'Abdulla Qodiriy': 'Абдулла Кадыри', 'Yunus Rajabiy': 'Юнус Раджаби', 'Ming Orik': 'Мингурик',
  Texnopark: 'Технопарк', Yashnobod: 'Яшнабад', Tuzel: 'Тузель', Olmos: 'Алмас', Rohat: 'Рохат', Yangiobod: 'Янгиабад', Qoyliq: 'Куйлюк',
  Matonat: 'Матонат', Qiyot: 'Кият', Tolariq: 'Толарык', Xonobod: 'Хонабад', Quruvchilar: 'Курувчилар', Turon: 'Туран', Qipchoq: 'Кипчак',
}

const LEGACY_TO_CANONICAL: Record<string, string> = {
  'Buyuk Ipak Yuli': 'Buyuk Ipak Yoli', 'Буюк Ипак Йули': 'Buyuk Ipak Yoli',
  Bunyodkor: 'Xalqlar Dostligi', 'Бунёдкор': 'Xalqlar Dostligi', 'Халклар Дустлиги': 'Xalqlar Dostligi',
  'Qo‘yliq': 'Qoyliq', "Qo'yliq": 'Qoyliq', 'Куйлюк': 'Qoyliq',
  'Мирзо Улугбек': 'Mirzo Ulugbek', 'Чиланзар': 'Chilonzor', 'Юнусабад': 'Yunusobod',
}

const RU_TO_CANONICAL = Object.fromEntries(Object.entries(RU).map(([canonical, ru]) => [ru, canonical]))

export function metroLabel(value: string, locale = 'en'): string {
  const canonical = LEGACY_TO_CANONICAL[value] || value
  return locale.toLowerCase().startsWith('ru') ? (RU[canonical] || value) : canonical
}

export function canonicalMetroValue(value: string): string {
  return RU_TO_CANONICAL[value] || LEGACY_TO_CANONICAL[value] || value
}
