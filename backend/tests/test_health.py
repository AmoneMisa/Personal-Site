import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.responses import JSONResponse

from src import main


class BackendHealthTests(unittest.IsolatedAsyncioTestCase):
    async def test_live_reports_process_liveness(self):
        self.assertEqual(await main.live(), {"ok": True})

    async def test_ready_checks_state_directory_and_required_binaries(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(main, "BACKEND_STATE_DIR", Path(tmpdir)):
                with patch.object(main.shutil, "which", side_effect=lambda name: f"/usr/bin/{name}"):
                    self.assertEqual(await main.ready(), {"ok": True})

    async def test_ready_returns_503_when_a_required_binary_is_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(main, "BACKEND_STATE_DIR", Path(tmpdir)):
                with patch.object(main.shutil, "which", side_effect=lambda name: None if name == "soffice" else f"/usr/bin/{name}"):
                    response = await main.ready()

        self.assertIsInstance(response, JSONResponse)
        self.assertEqual(response.status_code, 503)
        self.assertIn(b"libreoffice", response.body)


if __name__ == "__main__":
    unittest.main()
