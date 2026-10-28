import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_exchange_calendar", ROOT / "scripts/build-exchange-calendar.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class ExchangeCalendarTests(unittest.TestCase):
    def setUp(self):
        self.review = json.loads((ROOT / "config/us-equity-calendar-review.json").read_text())

    def test_committed_schedule_reproduces_without_renewing_review_or_generation(self):
        previous = json.loads((ROOT / "data/us-equity-sessions.json").read_text())
        result = generator.build_schedule(self.review, previous["generatedAt"])
        self.assertEqual(result, previous)
        self.assertEqual(result["reviewedAt"], self.review["reviewedAt"])

    def test_official_mismatch_fails_before_replace(self):
        self.review["holidays"].remove("2026-11-26")
        with self.assertRaisesRegex(ValueError, "differs from reviewed"):
            generator.build_schedule(self.review)
        self.review["holidays"].append("2026-11-26")
        self.review["earlyCloses"].remove("2026-11-27")
        with self.assertRaisesRegex(ValueError, "differs from reviewed"):
            generator.build_schedule(self.review)

    def test_failed_atomic_replace_preserves_original(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "sessions.json"
            target.write_text("previous verified data")
            with patch.object(generator.os, "replace", side_effect=OSError("fixture failure")):
                with self.assertRaises(OSError):
                    generator.write_schedule(target, {"new": "data"})
            self.assertEqual(target.read_text(), "previous verified data")
            self.assertFalse(target.with_suffix(".json.tmp").exists())
