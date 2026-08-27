import { syncActiveFlatRouteState } from "~/composables/flats/useFlatRouteState";

export async function syncQueryParams() {
  await syncActiveFlatRouteState();
}
