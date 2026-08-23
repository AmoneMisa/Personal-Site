// Compatibility facade for existing Nitro/server imports.
// Cursor persistence is runtime-neutral and lives in shared/hiring.

export {
  emptyCursor,
  emptyWebCursor,
  loadCursors,
  loadWebCursors,
  saveCursor,
  saveWebCursor,
} from '../../shared/hiring/hiringCursors'

export type {
  ChannelCursor,
  WebCursor,
} from '../../shared/hiring/hiringCursors'
