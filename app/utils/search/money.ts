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
  const symbol = currencySymbol(normalized);
  const value = Math.round(amount).toLocaleString(locale);
  return symbol === normalized ? `${value} ${symbol}` : `${symbol}${value}`;
}

export function formatCompactNumber(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 1_000) return Math.round(amount).toLocaleString("en-US");
  const [divisor, suffix] = abs >= 1_000_000_000
    ? [1_000_000_000, "B"] as const
    : abs >= 1_000_000
      ? [1_000_000, "M"] as const
      : [1_000, "K"] as const;
  const scaled = amount / divisor;
  const rounded = Number(scaled.toFixed(Math.abs(scaled) >= 100 ? 1 : 1));
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`;
}

/**
 * Compact card-only salary text. Full source strings stay untouched and remain
 * available in card tooltips and vacancy details.
 */
export function compactSalaryText(value: string): string {
  const compactNumbers = value.replace(/\d(?:[\d\s\u00a0\u202f,.]*\d)?/g, (token) => {
    const normalized = token.replace(/[\s\u00a0\u202f,]/g, "");
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 1_000 ? formatCompactNumber(amount) : token;
  });
  // JavaScript \b is ASCII-oriented, so use explicit Cyrillic token matching.
  const compactPeriods = compactNumbers
    .replace(/месяц/giu, "м.")
    .replace(/год/giu, "г.");

  const currencyCodes = Object.keys(CURRENCY_SYMBOLS).join("|");
  const amountBeforeCurrency = new RegExp(
    `([+-]?\\d[\\d.,]*(?:K|M|B)?(?:\\s*[–—-]\\s*[+-]?\\d[\\d.,]*(?:K|M|B)?)?)\\s+(${currencyCodes})\\b`,
    "gi",
  );
  const currencyCode = new RegExp(`\\b(${currencyCodes})\\b`, "gi");

  return compactPeriods
    .replace(amountBeforeCurrency, (_match, amount: string, code: string) => `${currencySymbol(code)}${amount}`)
    .replace(currencyCode, (code) => currencySymbol(code))
    .replace(/([$€£])\s+(?=\d)/g, (symbol) => symbol);
}

export function convertSalaryPeriod(amount: number, from: SalaryPeriod, to: SalaryPeriod): number {
  return amount * PERIODS_PER_YEAR[from] / PERIODS_PER_YEAR[to];
}
