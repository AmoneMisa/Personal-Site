type SafeFetchOptions = {
    params?: Record<string, unknown>;
    timeout?: number;
    signal?: AbortSignal;
    [key: string]: unknown;
};

export async function safeFetch<T>(url: string, opts: SafeFetchOptions = {}): Promise<{ data: T | null, error: unknown | null }> {
    try {
        // OLX details must be verified before the popup opens. The backend owns
        // freshness in PostgreSQL and either returns its cached result immediately
        // or performs a bounded live probe. Give that bounded probe enough time to
        // complete instead of cutting it off at the old 3s frontend timeout.
        const isBlockingFlatAvailabilityCheck = url === "/flats-feed"
            && Boolean(opts?.params?.listingId)
            && String(opts?.params?.sources || "").toLowerCase() === "olx"
            && String(opts?.params?.limit || "") === "1";
        const requestOptions = isBlockingFlatAvailabilityCheck && opts?.timeout == null
            ? { ...opts, timeout: 15000 }
            : opts;

        const data = await $fetch<T>(url, requestOptions as Parameters<typeof $fetch>[1]);
        return { data, error: null };
    } catch (err: unknown) {
        if (!(err instanceof Error && err.name === "AbortError")) {
            console.error("Fetch error:", err);
        }
        return { data: null, error: err };
    }
}
