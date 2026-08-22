# Temporary compatibility alias for older router imports.
# There is no Redis client or Redis server behind this module anymore.
from .state_store import PersistentFileKV, get_state_store


def get_redis() -> PersistentFileKV:
    return get_state_store()
