// Application-facing boundary for the secondary web-CV sources.
//
// The legacy module still owns the board-specific crawlers and persistence for
// NovaRobota, Layboard and Amountwork. Keeping that implementation behind this
// source boundary lets the application/worker layers stop depending on
// `server/utils` while those adapters are split out incrementally.
export {
  crawlSecondaryWebSource,
  refreshHiringSecondaryWebSource,
} from '../../utils/hiringSecondaryWebSources'
