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
_MAX_STATE_FILES = max(100, int(os.getenv("BACKEND_STATE_MAX_FILES", "5000")))
_SWEEP_EVERY_WRITES = max(10, int(os.getenv("BACKEND_STATE_SWEEP_EVERY_WRITES", "100")))
_SWEEP_INTERVAL_SECONDS = max(5.0, float(os.getenv("BACKEND_STATE_SWEEP_INTERVAL_SECONDS", "60")))
_store = None


@dataclass
class _KeyLockState:
    lock: asyncio.Lock
    users: int = 0


_locks: dict[str, _KeyLockState] = {}
_locks_guard = asyncio.Lock()
_sweep_guard = asyncio.Lock()
_writes_since_sweep = 0
_last_sweep_at = 0.0


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


def _read_payload(path: Path) -> Optional[dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError, TypeError):
        return None
    return payload if isinstance(payload, dict) else None


def _read_sync(key: str) -> Optional[str]:
    path = _path(key)
    payload = _read_payload(path)
    if payload is None:
        return None

    expires_at = payload.get("expiresAt")
    if expires_at is not None and float(expires_at) <= time.time():
        try:
            path.unlink()
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


def _sweep_sync(max_files: int = _MAX_STATE_FILES, now: Optional[float] = None) -> int:
    """Remove expired/corrupt cache files and cap the remaining cache cardinality."""
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    current_time = time.time() if now is None else now
    live: list[tuple[float, Path]] = []
    removed = 0

    for path in _STATE_DIR.glob("*.json"):
        payload = _read_payload(path)
        if payload is None:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
            continue

        expires_at = payload.get("expiresAt")
        try:
            expired = expires_at is not None and float(expires_at) <= current_time
        except (TypeError, ValueError):
            expired = True

        if expired:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
            continue

        try:
            live.append((path.stat().st_mtime, path))
        except OSError:
            continue

    overflow = max(0, len(live) - max(1, int(max_files)))
    if overflow:
        for _, path in sorted(live, key=lambda item: (item[0], item[1].name))[:overflow]:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass

    return removed


async def _maybe_sweep(force: bool = False) -> None:
    global _writes_since_sweep, _last_sweep_at

    now = time.monotonic()
    due = (
        force
        or _writes_since_sweep >= _SWEEP_EVERY_WRITES
        or now - _last_sweep_at >= _SWEEP_INTERVAL_SECONDS
    )
    if not due:
        return

    async with _sweep_guard:
        now = time.monotonic()
        due = (
            force
            or _writes_since_sweep >= _SWEEP_EVERY_WRITES
            or now - _last_sweep_at >= _SWEEP_INTERVAL_SECONDS
        )
        if not due:
            return
        await asyncio.to_thread(_sweep_sync)
        _writes_since_sweep = 0
        _last_sweep_at = now


class PersistentFileKV:
    async def get(self, key: str):
        return await asyncio.to_thread(_read_sync, key)

    async def set(self, key: str, value, ex=None, px=None, nx=False):
        global _writes_since_sweep

        async with _key_lock(key):
            if nx and await self.get(key) is not None:
                return None

            expires_at = None
            if ex is not None:
                expires_at = time.time() + float(ex)
            elif px is not None:
                expires_at = time.time() + float(px) / 1000.0

            await asyncio.to_thread(_write_sync, key, str(value), expires_at)
            _writes_since_sweep += 1

        await _maybe_sweep()
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

    async def sweep(self) -> int:
        """Force cleanup, primarily for startup/maintenance and tests."""
        global _writes_since_sweep, _last_sweep_at
        async with _sweep_guard:
            removed = await asyncio.to_thread(_sweep_sync)
            _writes_since_sweep = 0
            _last_sweep_at = time.monotonic()
            return removed


def get_state_store() -> PersistentFileKV:
    global _store
    if _store is None:
        _STATE_DIR.mkdir(parents=True, exist_ok=True)
        _store = PersistentFileKV()
    return _store
