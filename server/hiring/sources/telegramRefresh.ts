// Application-facing boundary for Telegram hiring channel refreshes.
//
// The queue/application layer depends on the canonical application service;
// legacy server/utils/hiringStore.ts is no longer part of the per-channel
// worker path.
export { refreshHiringChannel } from '../application/refreshTelegramChannel'
