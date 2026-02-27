// server/api/teleport/scores.get.ts
import { defineEventHandler, getQuery, createError } from "h3";
import { $fetch } from "ofetch";
import Redis from "ioredis";

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

function getRedis() {
    const config = useRuntimeConfig();
    // config.redis.url = "redis://..."
    return new Redis(config.redis.url);
}

export default defineEventHandler(async (event) => {
    const { slug } = getQuery(event);

    if (!slug || typeof slug !== "string") {
        throw createError({ statusCode: 400, statusMessage: "slug is required" });
    }

    const redis = getRedis();
    const cacheKey = `teleport:scores:${slug}`;

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Teleport scores endpoint
    const url = `https://api.teleport.org/api/urban_areas/slug:${encodeURIComponent(slug)}/scores/`;
    const raw = await $fetch<any>(url);

    // Нормализуем в удобный формат
    const normalized = {
        slug,
        overall: typeof raw.teleport_city_score === "number" ? raw.teleport_city_score : null,
        categories: Array.isArray(raw.categories)
            ? raw.categories.map((c: any) => ({
                key: String(c.name || "").toUpperCase().replace(/\s+/g, "_"),
                name: c.name,
                score: typeof c.score_out_of_10 === "number" ? c.score_out_of_10 : null
            }))
            : []
    };

    await redis.set(cacheKey, JSON.stringify(normalized), "EX", TTL_SECONDS);
    await redis.quit();

    return normalized;
});