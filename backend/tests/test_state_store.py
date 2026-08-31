import asyncio
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from src.utils import state_store


class StateStoreLockTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.state_dir_patch = patch.object(state_store, "_STATE_DIR", Path(self.tmpdir.name))
        self.state_dir_patch.start()
        self.addCleanup(self.state_dir_patch.stop)
        state_store._locks.clear()
        state_store._writes_since_sweep = 0
        state_store._last_sweep_at = time.monotonic()

    async def test_many_unique_keys_do_not_leave_lock_objects_behind(self):
        store = state_store.PersistentFileKV()
        for index in range(200):
            await store.set(f"key-{index}", f"value-{index}")

        self.assertEqual(state_store._locks, {})

    async def test_same_key_operations_stay_serialized_and_release_lock_state(self):
        store = state_store.PersistentFileKV()

        async def write(value: str):
            await store.set("shared", value)

        await asyncio.gather(*(write(str(index)) for index in range(50)))

        self.assertIsNotNone(await store.get("shared"))
        self.assertEqual(state_store._locks, {})

    async def test_nx_remains_atomic_for_competing_writers(self):
        store = state_store.PersistentFileKV()

        results = await asyncio.gather(
            *(store.set("nx-key", str(index), nx=True) for index in range(20))
        )

        self.assertEqual(results.count(True), 1)
        self.assertEqual(results.count(None), 19)
        self.assertEqual(state_store._locks, {})

    async def test_sweep_removes_expired_and_corrupt_files(self):
        now = time.time()
        live = Path(self.tmpdir.name) / "live.json"
        expired = Path(self.tmpdir.name) / "expired.json"
        corrupt = Path(self.tmpdir.name) / "corrupt.json"
        live.write_text(json.dumps({"value": "ok", "expiresAt": now + 60}), encoding="utf-8")
        expired.write_text(json.dumps({"value": "old", "expiresAt": now - 1}), encoding="utf-8")
        corrupt.write_text("{not-json", encoding="utf-8")

        removed = state_store._sweep_sync(max_files=10, now=now)

        self.assertEqual(removed, 2)
        self.assertTrue(live.exists())
        self.assertFalse(expired.exists())
        self.assertFalse(corrupt.exists())

    async def test_sweep_caps_live_cache_files_by_oldest_mtime(self):
        now = time.time()
        paths = []
        for index in range(5):
            path = Path(self.tmpdir.name) / f"{index}.json"
            path.write_text(json.dumps({"value": str(index), "expiresAt": now + 60}), encoding="utf-8")
            stamp = now - (10 - index)
            os.utime(path, (stamp, stamp))
            paths.append(path)

        removed = state_store._sweep_sync(max_files=3, now=now)

        self.assertEqual(removed, 2)
        self.assertFalse(paths[0].exists())
        self.assertFalse(paths[1].exists())
        self.assertTrue(all(path.exists() for path in paths[2:]))


if __name__ == "__main__":
    unittest.main()
