// Temporary compatibility shim for modules that have not been renamed yet.
// There is no Redis client, Redis protocol or Redis service behind this module.
// New code must import from ./stateStore directly.

import { stateStoreReady, useStateStore } from './stateStore'

export const useRedis = useStateStore
export const redisReady = (_timeoutMs = 2_000) => stateStoreReady()
