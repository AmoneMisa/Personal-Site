// Live currency → USD rates for salary normalization + display.
//
// Previously the rates were hard-coded (and drifted out of date). Now they are
// pulled from a free, key-less exchange-rate API (open.er-api.com, USD base),
// cached in Redis (24h) and mirrored in memory so the hot path (enrich.ts,
// called per job per request) stays synchronous. Every value is stored as
// USD-per-1-unit (e.g. UAH -> ~0.024), so `amount * rate = USD`.
//
// The static table below is only a FALLBACK for a cold cache or an API outage —
// the live fetch overwrites it. Russia/Belarus intentionally omitted.

import { useRedis } from '~~/server/utils/redis'

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, PLN: 0.25, UAH: 0.024, KZT: 0.0019,
  UZS: 0.000079, AZN: 0.59, GEL: 0.37, AMD: 0.0026, KGS: 0.011, MDL: 0.056,
  TJS: 0.092, TMT: 0.286, TRY: 0.030, CAD: 0.73, CHF: 1.12, INR: 0.012,
  CNY: 0.14, JPY: 0.0064, KRW: 0.00072,
}

const RATES_KEY = 'jobs:fx:usd-rates:v1'
const RATES_TTL_SECONDS = 24 * 3600
const FX_API_URL = 'https://open.er-api.com/v6/latest/USD'
const FX_TIMEOUT_MS = 10_000
const EXCLUDED_CURRENCIES = new Set(['RUB', 'BYN'])

// In-memory cache (USD-per-unit). Seeded with the fallback so toUsd() works even
// before the first load; overwritten by loadRates()/refreshRates().
let memRates: Record<string, number> = { ...FALLBACK_USD_RATES }
let memLoaded = false

// open.er-api returns rates as UNITS-per-USD (base USD). Invert to USD-per-unit.
function invertToUsdPerUnit(unitsPerUsd: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [code, r] of Object.entries(unitsPerUsd)) {
    const normalized = code.toUpperCase()
    if (!EXCLUDED_CURRENCIES.has(normalized) && typeof r === 'number' && r > 0) {
      out[normalized] = 1 / r
    }
  }
  out.USD = 1
  return out
}

function sanitizeUsdPerUnit(rates: unknown): Record<string, number> {
  if (!rates || typeof rates !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [code, rate] of Object.entries(rates as Record<string, unknown>)) {
    const normalized = code.toUpperCase()
    if (
      /^[A-Z]{3}$/.test(normalized)
      && !EXCLUDED_CURRENCIES.has(normalized)
      && typeof rate === 'number'
      && Number.isFinite(rate)
      && rate > 0
    ) {
      out[normalized] = rate
    }
  }
  return out
}

/** Current USD-per-unit rate table (live if loaded, else the static fallback). */
export function getRates(): Record<string, number> {
  return memRates
}

/** Convert an amount in `currency` to whole USD, or undefined if unknown/invalid. */
export function toUsd(amount: number | undefined, currency: string | undefined): number | undefined {
  if (!amount || amount <= 0) return undefined
  const rate = memRates[(currency || 'USD').toUpperCase()]
  if (!rate) return undefined
  return Math.round(amount * rate)
}

/** Populate memory from the Redis cache once (fast path for the request handler). */
export async function loadRates(): Promise<void> {
  if (memLoaded) return
  try {
    const raw = await useRedis().get(RATES_KEY)
    if (raw) {
      memRates = { ...FALLBACK_USD_RATES, ...sanitizeUsdPerUnit(JSON.parse(raw)) }
      memLoaded = true
    }
  } catch {
    /* redis down — keep the fallback table */
  }
}

/**
 * Fetch live rates from the API, then persist to Redis + memory. Called by the
 * daily refresh worker and the cold-start warmup. Never throws — on failure the
 * previous (or fallback) table stays in use.
 */
export async function refreshRates(): Promise<void> {
  try {
    const res = await fetch(FX_API_URL, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`fx ${res.status}`)
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> }
    if (data.result !== 'success' || !data.rates) throw new Error('fx bad payload')
    const usdPerUnit = invertToUsdPerUnit(data.rates)
    memRates = { ...FALLBACK_USD_RATES, ...usdPerUnit }
    memLoaded = true
    try {
      await useRedis().set(RATES_KEY, JSON.stringify(usdPerUnit), 'EX', RATES_TTL_SECONDS)
    } catch {
      /* best-effort persist */
    }
  } catch (err) {
    console.error('[jobs] fx refresh failed:', (err as Error).message)
  }
}
