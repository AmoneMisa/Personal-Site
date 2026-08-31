import asyncio
import hashlib
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

_STATE_DIR = Path(os.getenv("BACKEND_STATE_DIR", "/var/app/state/backend"))
_store = None


@dataclass
class _KeyLockState:
    lock: asyncio.Lock
    users: int = 0


_locks: dict[str, _KeyLockState] = {}
_locks_guard = asyncio.Lock()


@asynccontextmanager
async def _key_lock(key: str):
    """Serialize one key without retaining one asyncio.Lock per historical key."""
    async with _locks_guard:
        state = _locks.get(key)
        if state is None:
            state = _KeyLockState(lock=asyncio.Lock())
            _locks[key] = state
        state.users += 1

    try:
        async with state.lock:
            yield
    finally:
        async with _locks_guard:
            state.users -= 1
            if state.users == 0 and _locks.get(key) is state:
                _locks.pop(key, None)


def _path(key: str) -> Path:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return _STATE_DIR / f"{digest}.json"


def _remove_sync(key: str) -> bool:
    path = _path(key)
    try:
        path.unlink()
        return True
    except FileNotFoundError:
        return False
    except OSError:
        return False


def _read_sync(key: str) -> Optional[str]:
    path = _path(key)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError, TypeError):
        return None

    expires_at = payload.get("expiresAt")
    if expires_at is not None and float(expires_at) <= time.time():
        _remove_sync(key)
        return None

    value = payload.get("value")
    return None if value is None else str(value)


def _write_sync(key: str, value: str, expires_at: Optional[float]) -> None:
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    path = _path(key)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    tmp.write_text(
        json.dumps({"value": str(value), "expiresAt": expires_at}, ensure_ascii=False),
        encoding="utf-8",
    )
    os.replace(tmp, path)


class PersistentFileKV:
    async def get(self, key: str):
        return await asyncio.to_thread(_read_sync, key)

    async def set(self, key: str, value, ex=None, px=None, nx=False):
        async with _key_lock(key):
            if nx and await self.get(key) is not None:
                return None

            expires_at = None
            if ex is not None:
                expires_at = time.time() + float(ex)
            elif px is not None:
                expires_at = time.time() + float(px) / 1000.0

            await asyncio.to_thread(_write_sync, key, str(value), expires_at)
            return True

    async def delete(self, *keys: str):
        removed = 0
        for key in keys:
            async with _key_lock(key):
                if await asyncio.to_thread(_remove_sync, key):
                    removed += 1
        return removed

    async def exists(self, key: str):
        return 1 if await self.get(key) is not None else 0


def get_state_store() -> PersistentFileKV:
    global _store
    if _store is None:
        _STATE_DIR.mkdir(parents=True, exist_ok=True)
        _store = PersistentFileKV()
    return _store
