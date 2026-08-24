export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export type SalaryPeriod = "hour" | "month" | "year";

const HOURS_PER_MONTH = 160;
const PERIODS_PER_YEAR: Readonly<Record<SalaryPeriod, number>> = {
  hour: 12 * HOURS_PER_MONTH,
  month: 12,
  year: 1,
};

export function currencySymbol(currency: string): string {
  const normalized = currency.toUpperCase();
  return CURRENCY_SYMBOLS[normalized] || normalized;
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Readonly<Record<string, number>>,
  rateMode: "currencyPerUsd" | "usdPerCurrency" = "currencyPerUsd",
): number | undefined {
  const sourceRate = rates[from.toUpperCase()];
  const targetRate = rates[to.toUpperCase()];
  if (!sourceRate || !targetRate) return undefined;
  return rateMode === "usdPerCurrency"
    ? (amount * sourceRate) / targetRate
    : (amount * targetRate) / sourceRate;
}

export function formatMoney(amount: number, currency: string, locale?: string): string {
  const normalized = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString(locale)} ${currencySymbol(normalized)}`;
  }
}

export function convertSalaryPeriod(amount: number, from: SalaryPeriod, to: SalaryPeriod): number {
  return amount * PERIODS_PER_YEAR[from] / PERIODS_PER_YEAR[to];
}
