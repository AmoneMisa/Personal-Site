export type TeleportScores = {
    slug: string;
    overall: number | null;
    categories: Array<{ key: string; name: string; score: number | null }>;
};

export function useTeleportScores() {
    const cache = useState<Record<string, TeleportScores | null>>("teleportScoresCache", () => ({}));
    const loading = useState<Record<string, boolean>>("teleportScoresLoading", () => ({}));

    const load = async (slug: string) => {
        if (!slug) return null;
        if (cache.value[slug] !== undefined) return cache.value[slug];

        loading.value[slug] = true;
        try {
            const data = await $fetch<TeleportScores>("/api/teleport/scores", { query: { slug } });
            cache.value[slug] = data;
            return data;
        } catch (e) {
            cache.value[slug] = null; // 404 тоже сюда
            return null;
        } finally {
            loading.value[slug] = false;
        }
    };

    return { cache, loading, load };
}