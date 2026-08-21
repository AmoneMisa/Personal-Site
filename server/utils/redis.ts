import Redis from "ioredis";

let redis: Redis;

export function useRedis() {
    if (!redis) {
        redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
            // Fail commands fast when Redis is unavailable so the callers'
            // try/catch fallbacks (empty list / live fetch) kick in instead of
            // buffering commands and hanging the request until reconnect.
            maxRetriesPerRequest: 2,
            // ...but not during the first moments of the process. Work that
            // starts on boot — store warm-up, a queued refresh — would
            // otherwise fail with "Stream isn't writeable" purely because the
            // socket has not finished connecting, which has read as an outage
            // in the logs and taken down a refresh with a 500. Commands are
            // buffered until the connection settles, then fail fast as before.
            enableOfflineQueue: true,
        });
        const failFast = () => {
            redis.options.enableOfflineQueue = false;
        };
        // The buffer lasts exactly as long as the first connection attempt:
        // ready means the socket is usable, and a connection error means there
        // is nothing to wait for — a missing Redis must never make requests
        // queue up behind a connection that is not coming.
        redis.once("ready", failFast);
        redis.once("error", failFast);
        setTimeout(failFast, 15_000).unref?.();
        // Without an 'error' listener, ioredis connection errors surface as
        // unhandled 'error' events (noisy, and can crash the process).
        redis.on("error", (err) => {
            console.error("[redis] connection error:", err.message);
        });
    }
    return redis;
}

/**
 * Waits for the connection to be usable, briefly.
 *
 * With the offline queue disabled, a command issued in the first moments after
 * boot fails outright with "Stream isn't writeable" — not because Redis is
 * down, but because the socket has not finished connecting. Startup readers
 * hit this on every deploy, log a scary error and fall back to the slow path.
 * Waiting a moment is both cheaper and truthful.
 */
let firstConnect: Promise<boolean> | undefined;

export async function redisReady(timeoutMs = 2_000): Promise<boolean> {
    const client = useRedis();
    if (client.status === "ready") return true;
    if (client.status === "end") return false;
    // Only the first caller ever waits. Where there is no Redis at all — local
    // development, a dead container — every later call must fall through
    // immediately instead of paying the timeout again on every request.
    if (firstConnect) return firstConnect;

    firstConnect = new Promise<boolean>((resolve) => {
        const done = (value: boolean) => {
            clearTimeout(timer);
            client.off("ready", onReady);
            client.off("error", onError);
            resolve(value);
        };
        const onReady = () => done(true);
        const onError = () => done(false);
        const timer = setTimeout(() => done(client.status === "ready"), timeoutMs);

        client.once("ready", onReady);
        client.once("error", onError);
    });
    return firstConnect;
}
