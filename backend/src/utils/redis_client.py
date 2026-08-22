import asyncio
import hashlib
import json
import os
import time
import uuid
from pathlib import Path
from typing import Optional


# Compatibility adapter for the handful of backend routes that previously used
# Redis only as a TTL key/value cache (PDF session markers, country indices and
# DockerHub responses). State lives on a Docker named volume, so removing the
# Redis service does not make these values disappear on container recreation.
_STATE_DIR = Path(os.getenv("BACKEND_STATE_DIR", "/var/app/state/backend"))
_locks: dict[str, asyncio.Lock] = {}
_store = None


def _path(key: str) -> Path:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return _STATE_DIR / f"{digest}.json"


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
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
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
        lock = _locks.setdefault(key, asyncio.Lock())
        async with lock:
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
            lock = _locks.setdefault(key, asyncio.Lock())
            async with lock:
                path = _path(key)
                existed = await asyncio.to_thread(path.exists)
                try:
                    await asyncio.to_thread(path.unlink, True)
                except TypeError:
                    # Python versions where Path.unlink's missing_ok is keyword-only.
                    try:
                        await asyncio.to_thread(path.unlink, missing_ok=True)
                    except OSError:
                        pass
                except OSError:
                    pass
                if existed:
                    removed += 1
        return removed

    async def exists(self, key: str):
        return 1 if await self.get(key) is not None else 0


async def _ensure_state_dir() -> None:
    await asyncio.to_thread(_STATE_DIR.mkdir, parents=True, exist_ok=True)


def get_redis():
    global _store
    if _store is None:
        _STATE_DIR.mkdir(parents=True, exist_ok=True)
        _store = PersistentFileKV()
    return _store
