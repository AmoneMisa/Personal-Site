import { computed, ref } from "vue";
import { canonicalCountryCode } from "@whiteslove/parsing-lexicon";
import { JOB_COUNTRY_OPTIONS } from "~/composables/jobs/useJobMeta";
import { safeFetch } from "~/utils/safeFetch";

// Country codes the jobs board actually searches. Reused rather than restated so
// the quiz can never offer a link the jobs page would reject.
const JOB_COUNTRY_CODES = new Set(
  JOB_COUNTRY_OPTIONS.map((option) => option.value).filter(Boolean),
);

// Which countries the apartment feed covers is upstream data (Flat Finder owns
// it), so it is fetched rather than hard-coded here — see AGENTS.md §12/§13.
// One module-level request is shared by every card on the page.
const flatCountryCodes = ref<Set<string> | null>(null);
let flatCountriesRequest: Promise<void> | null = null;

function loadFlatCountries() {
  if (flatCountriesRequest || flatCountryCodes.value) return;
  flatCountriesRequest = (async () => {
    const { data } = await safeFetch<Array<{ code?: string }>>("/flats-meta");
    // A failed lookup leaves the set empty, which just hides the apartment links.
    flatCountryCodes.value = new Set(
      Array.isArray(data)
        ? data.map((entry) => String(entry?.code || "").toUpperCase()).filter(Boolean)
        : [],
    );
  })().catch(() => {
    flatCountryCodes.value = new Set();
  });
}

/**
 * Resolves a quiz result entity to the ISO country code the rest of the site
 * filters by.
 *
 * `key` is the quiz's own identifier (`countries.ukraine`, or `countries.usa.tx`
 * / `countries.usa.tx.city` for the per-state variants). US state variants all
 * resolve to US; everything else goes through the shared lexicon rather than a
 * local name→code table.
 */
export function countryCodeForEntity(key: string, fallbackName: string): string | null {
  if (key === "countries.usa" || key.startsWith("countries.usa.")) return "US";
  return canonicalCountryCode(fallbackName) || null;
}

export function useCountryDestinations() {
  if (import.meta.client) loadFlatCountries();

  const localePath = useLocalePath();

  /**
   * The site destinations that can actually be filtered to this country. Returns
   * an empty list when nothing supports it, so callers render nothing rather than
   * a dead link.
   */
  function destinationsFor(key: string, fallbackName: string) {
    const code = countryCodeForEntity(key, fallbackName);
    if (!code) return [];

    const links: Array<{ id: "jobs" | "flats"; to: string; icon: string }> = [];
    if (JOB_COUNTRY_CODES.has(code)) {
      links.push({ id: "jobs", to: localePath(`/jobs?country=${code}`), icon: "i-lucide-briefcase" });
    }
    if (flatCountryCodes.value?.has(code)) {
      links.push({ id: "flats", to: localePath(`/flat-finder?countries=${code}`), icon: "i-lucide-building-2" });
    }
    return links;
  }

  return { destinationsFor, flatCountryCodes: computed(() => flatCountryCodes.value) };
}
