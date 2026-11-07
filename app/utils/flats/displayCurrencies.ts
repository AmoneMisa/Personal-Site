/**
 * Currencies a visitor can pick for prices on the flat finder: USD, EUR and RUB
 * as common references, then the national currency of every supported country
 * (UZ, KZ, UA, RO, KG). Order is the order shown in the selector.
 */
export const FLAT_DISPLAY_CURRENCIES = ["USD", "EUR", "RUB", "UZS", "KZT", "UAH", "RON", "KGS"] as const;

export function isFlatDisplayCurrency(value: string): boolean {
  return (FLAT_DISPLAY_CURRENCIES as readonly string[]).includes(value);
}
