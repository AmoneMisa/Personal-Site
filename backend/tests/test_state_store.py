import asyncio
import tempfile
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


if __name__ == "__main__":
    unittest.main()
