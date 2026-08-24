import type { LocationQuery, Router } from "vue-router";
import { useSearchRouteState } from "../search/useSearchRouteState";

export function useHiringRouteState(
  router: Router,
  route: { query: LocationQuery },
  serialize: () => Record<string, string>,
  deserialize: (query: LocationQuery | Record<string, unknown>) => void,
) {
  return useSearchRouteState({
    router,
    serialize,
    deserialize,
    preserve: () => {
      const preserved: Record<string, string> = {};
      for (const key of ["cv", "cvSource", "cvCountry"] as const) {
        const value = queryString(route.query[key]);
        if (value) preserved[key] = value;
      }
      return preserved;
    },
    debounceMs: 160,
  });
}

import { queryString } from "~/utils/queryParams";
