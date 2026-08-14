import Redis from "ioredis";

let redis: Redis;

export function useRedis() {
    if (!redis) {
        redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
            // Fail commands fast when Redis is unavailable so the callers'
            // try/catch fallbacks (empty list / live fetch) kick in instead of
            // buffering commands and hanging the request until reconnect.
            maxRetriesPerRequest: 2,
            enableOfflineQueue: false,
        });
        // Without an 'error' listener, ioredis connection errors surface as
        // unhandled 'error' events (noisy, and can crash the process).
        redis.on("error", (err) => {
            console.error("[redis] connection error:", err.message);
        });
    }
    return redis;
}
