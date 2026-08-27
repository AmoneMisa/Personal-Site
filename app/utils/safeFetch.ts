export async function safeFetch<T>(url: string, opts: any = {}): Promise<{ data: T | null, error: any | null }> {
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
            ? { ...opts, timeout: 7000 }
            : opts;

        const data = await $fetch<T>(url, requestOptions);
        return { data, error: null };
    } catch (err: any) {
        console.error("Fetch error:", err);
        return { data: null, error: err };
    }
}
