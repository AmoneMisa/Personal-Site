import type { CountryMeta } from '../contracts/hiring'

/** Markets currently supported by candidate ingestion and hiring filters. */
export const HIRING_COUNTRIES: readonly CountryMeta[] = [
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', cities: ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Qarshi', 'Nukus', 'Urgench', 'Khiva'] },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', cities: ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro', 'Vinnytsia', 'Zaporizhzhia'] },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', cities: ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Atyrau', 'Aktobe'] },
  { code: 'KG', name: 'Kyrgyzstan', currency: 'KGS', cities: ['Bishkek', 'Osh', 'Karakol'] },
] as const
