import { useFlatFilters as useFlatFiltersBase } from "./useFlatFiltersBase";

/**
 * Public Flat Finder filter facade.
 *
 * The base composable keeps the established UI/route state, while this facade
 * owns the backend contract for geographic membership: every selected metro
 * station, radius and optional directional arc is sent upstream. The browser
 * must not compensate by filtering an already paginated response.
 */
export function useFlatFilters() {
  const filters = useFlatFiltersBase();
  const buildBaseFeedParams = filters.buildFeedParams;

  function buildFeedParams(
    options: Parameters<typeof buildBaseFeedParams>[0],
  ): ReturnType<typeof buildBaseFeedParams> {
    const params = buildBaseFeedParams(options);
    const stations = [...new Set(filters.metro.value.map((name) => String(name).trim()).filter(Boolean))];

    if (stations.length) {
      params.metro = stations.join(",");
      if (filters.metroMaxM.value != null) {
        params.metroMaxM = String(filters.metroMaxM.value);
      } else {
        delete params.metroMaxM;
      }

      if (filters.metroBearingFrom.value != null && filters.metroBearingTo.value != null) {
        params.metroArc = `${filters.metroBearingFrom.value},${filters.metroBearingTo.value}`;
      } else {
        delete params.metroArc;
      }
    } else {
      delete params.metro;
      delete params.metroMaxM;
      delete params.metroArc;
    }

    return params;
  }

  return {
    ...filters,
    buildFeedParams,
  };
}
