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
        // ofetch rethrows an aborted request as a FetchError whose `cause` is the
        // AbortError, so check the cause and the caller's signal too.
        const cause = (err as { cause?: { name?: string } } | null)?.cause;
        const aborted = (err instanceof Error && err.name === "AbortError")
            || cause?.name === "AbortError"
            || Boolean(opts.signal?.aborted);
        if (!aborted) {
            console.error("Fetch error:", err);
        }
        return { data: null, error: err };
    }
}
