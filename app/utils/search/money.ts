import {
  CURRENCY_TERMS,
  currencySymbol as sharedCurrencySymbol,
} from "@whiteslove/parsing-lexicon/currency";

export type SalaryPeriod = "hour" | "day" | "shift" | "week" | "month" | "year" | "project" | "piece";
export type DisplaySalaryPeriod = "hour" | "month" | "year";

// Keep the site's established 160-hour work-month convention, but derive the
// other convertible periods from the same model so hourly/day/weekly salaries
// normalize consistently. Project/piece/shift rates intentionally have no
// implicit monthly conversion because their frequency is unknown.
const HOURS_PER_DAY = 8;
const HOURS_PER_MONTH = 160;
const WORK_DAYS_PER_MONTH = HOURS_PER_MONTH / HOURS_PER_DAY;
const PERIODS_PER_YEAR: Readonly<Partial<Record<SalaryPeriod, number>>> = {
  hour: 12 * HOURS_PER_MONTH,
  day: 12 * WORK_DAYS_PER_MONTH,
  week: 48,
  month: 12,
  year: 1,
};

const CURRENCY_CODES = Object.freeze(
  [...new Set(CURRENCY_TERMS.map((entry) => entry.canonical.toUpperCase()))],
);

export function currencySymbol(currency: string, locale = "en"): string {
  const normalized = currency.toUpperCase();
  return sharedCurrencySymbol(normalized, locale) || normalized;
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
  const symbol = currencySymbol(normalized, locale);
  const value = Math.round(amount).toLocaleString(locale);
  return symbol === normalized ? `${value} ${symbol}` : `${symbol}${value}`;
}

export interface MoneyAmountLike {
  amount: number;
  currency?: string | null;
  approximate?: boolean;
}

// Shared formatter for the structured {amount, currency, approximate} shape
// the parsing lexicon returns (utilitiesAmount, commissionAmount, perPersonPrice).
// Falls back to fallbackCurrency when the parsed value has no currency of its
// own (e.g. a bare "50 000" utilities mention with no unit) — never render
// the object itself, which stringifies to "[object Object]".
export function formatMoneyAmount(
  value: MoneyAmountLike | null | undefined,
  fallbackCurrency?: string,
  locale?: string,
): string | null {
  if (value == null || !Number.isFinite(value.amount)) return null;
  const currency = value.currency || fallbackCurrency;
  const formatted = currency ? formatMoney(value.amount, currency, locale) : Math.round(value.amount).toLocaleString(locale);
  return value.approximate ? `≈ ${formatted}` : formatted;
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

  const currencyCodes = CURRENCY_CODES.join("|");
  const amountBeforeCurrency = new RegExp(
    `([+-]?\\d[\\d.,]*(?:K|M|B)?(?:\\s*[–—-]\\s*[+-]?\\d[\\d.,]*(?:K|M|B)?)?)\\s+(${currencyCodes})\\b`,
    "gi",
  );
  const currencyCode = new RegExp(`\\b(${currencyCodes})\\b`, "gi");

  return compactPeriods
    .replace(amountBeforeCurrency, (_match, amount: string, code: string) => `${currencySymbol(code)}${amount}`)
    .replace(currencyCode, (code) => currencySymbol(code))
    .replace(/([$€£₴₽₺₾₩₹₼֏¥￥])\s+(?=\d)/g, (symbol) => symbol);
}

export function convertSalaryPeriod(
  amount: number,
  from: SalaryPeriod,
  to: DisplaySalaryPeriod,
): number | undefined {
  const sourcePeriods = PERIODS_PER_YEAR[from];
  const targetPeriods = PERIODS_PER_YEAR[to];
  if (!sourcePeriods || !targetPeriods) return undefined;
  return amount * sourcePeriods / targetPeriods;
}
