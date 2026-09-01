import { FixedWindowRateLimiter } from '../utils/fixedWindowRateLimiter'

new FixedWindowRateLimiter({
  limit: 10,
  windowMs: 60_000,
  maxEntries: 5_000,
});
