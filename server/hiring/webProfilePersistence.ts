// Infrastructure boundary for web-CV persistence.
//
// The implementation still lives in the legacy generic web-source module for
// this migration step. Source adapters import this boundary so the implementation
// can move later without coupling every adapter back to `hiringWebSources.ts`.

export {
  persistWebProfiles,
  type PersistResult as PersistWebProfilesResult,
} from '../utils/hiringWebSources'
