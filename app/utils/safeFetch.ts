export async function safeFetch<T>(url: string, opts: any = {}): Promise<{ data: T | null, error: any | null }> {
    try {
        // Opening a Flat Finder OLX card must not be blocked by the full feed
        // proxy budget. The feed already performs cached/background availability
        // verification; this exact lookup is only an extra freshness check.
        // If OLX cannot answer quickly, let the popup open from persisted data
        // instead of making the user wait for the upstream timeout.
        const isBlockingFlatAvailabilityCheck = url === "/flats-feed"
            && Boolean(opts?.params?.listingId)
            && String(opts?.params?.sources || "").toLowerCase() === "olx"
            && String(opts?.params?.limit || "") === "1";
        const requestOptions = isBlockingFlatAvailabilityCheck && opts?.timeout == null
            ? { ...opts, timeout: 3000 }
            : opts;

        const data = await $fetch<T>(url, requestOptions);
        return { data, error: null };
    } catch (err: any) {
        console.error("Fetch error:", err);
        return { data: null, error: err };
    }
}
