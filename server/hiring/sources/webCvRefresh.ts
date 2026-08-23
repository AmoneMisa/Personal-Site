// Application-facing boundary for generic web-CV sources.
//
// The legacy module still owns the board-specific parsers/crawlers during the
// incremental migration. Keeping it behind this source boundary lets the
// application/worker layers stop depending on `server/utils` directly.
export {
  auditWebSource,
  crawlWebSource,
  listWebSources,
  refreshHiringWebSource,
  type WebSourceAudit,
} from '../../utils/hiringWebSources'
