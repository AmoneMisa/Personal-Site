// Flat Finder already schedules route synchronization from the serialized filter
// watcher. This compatibility helper keeps the post-load call harmless instead
// of throwing when older page code still invokes syncQueryParams().
export function syncQueryParams() {
  // Intentionally empty: useFlatRouteState.schedule() owns URL synchronization.
}
