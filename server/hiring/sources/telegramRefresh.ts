// Application-facing boundary for Telegram hiring channel refreshes.
//
// `server/utils/hiringStore.ts` still owns the store merge/AI/persistence details
// during the incremental migration. Keeping the queue/application layer behind
// this module lets that legacy store be split without leaking its internals.
export { refreshHiringChannel } from '../../utils/hiringStore'
