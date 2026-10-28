import copy
import datetime as dt
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("collector", Path(__file__).resolve().parents[1] / "scripts/refresh-sec-filings.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NOW = dt.datetime(2026, 10, 21, 12, tzinfo=dt.timezone.utc)
TARGET = {"symbol": "AAPL", "cik": "0000320193", "name": "Apple Inc."}
CONFIG = {"lookbackDays": 180, "maxFilings": 40, "companies": [TARGET]}
ROW = {"form": "10-Q", "filing_date": "2026-07-31", "reportDate": "2026-06-27", "accession_number": "0000320193-26-000020"}


class MonitorTests(unittest.TestCase):
    def test_dates_amendments_order_and_agent_accession(self):
        amended = {**ROW, "form": "10-Q/A", "accession_number": "0001140361-26-000001"}
        rows = m.normalize_rows([ROW, amended, ROW], TARGET["cik"], "2026-04-24", "2026-10-21", 40)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["form"], "10-Q/A")
        self.assertIn('/320193/000114036126000001/', rows[0]["url"])
        self.assertEqual(rows[0]["reportDate"], "2026-06-27")
        missing = m.normalize_rows([{**ROW, "reportDate": ""}], TARGET['cik'], '2026-04-24', '2026-10-21', 40)
        self.assertIsNone(missing[0]['reportDate'])

    def test_invalid_metadata_never_becomes_successful_empty(self):
        for patch_row in [{"filing_date": "2026-02-30"}, {"filing_date": "2026-10-22"}, {"form": "4"}, {"accession_number": "../evil"}, {"reportDate": "2027-01-01"}]:
            with self.assertRaises((ValueError, TypeError)):
                m.normalize_rows([{**ROW, **patch_row}], TARGET['cik'], '2026-04-24', '2026-10-21', 40)

    def test_partial_failure_retains_original_receipt_and_cik(self):
        first, _ = m.refresh(CONFIG, None, lambda *args: m.normalize_rows([ROW], TARGET['cik'], '2026-04-24', '2026-10-21', 40), NOW)
        before = copy.deepcopy(first)
        def fail(*args): raise RuntimeError('private upstream error')
        later = NOW + dt.timedelta(hours=1)
        failed, count = m.refresh(CONFIG, first, fail, later)
        self.assertEqual(count, 1)
        self.assertEqual(failed['companies'][0]['status'], 'stale')
        for key in ['fetchedAt', 'filings', 'coverageFrom', 'coverageTo']:
            self.assertEqual(failed['companies'][0][key], first['companies'][0][key])
        self.assertEqual(first, before)
        foreign = copy.deepcopy(first); foreign['companies'][0]['cik'] = '0000000001'
        self.assertEqual(m.refresh(CONFIG, foreign, fail, later)[0]['companies'][0]['status'], 'unavailable')
        recovered, count = m.refresh(CONFIG, failed, lambda *args: [], later)
        self.assertEqual(count, 0); self.assertEqual(recovered['companies'][0]['status'], 'ok')
        self.assertEqual(recovered['companies'][0]['filings'], [])

    def test_initial_failure_and_atomic_output(self):
        def fail(*args): raise RuntimeError('unavailable')
        data, failures = m.refresh(CONFIG, None, fail, NOW)
        self.assertEqual(failures, 1)
        self.assertIsNone(data['companies'][0]['fetchedAt'])
        self.assertEqual(data['companies'][0]['status'], 'unavailable')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'out.json'; m.atomic_write(path, data)
            self.assertEqual(len(list(Path(folder).iterdir())), 1)
            self.assertNotIn('RuntimeError', path.read_text())

    def test_adapter_uses_cik_and_bounded_metadata_only(self):
        calls = []
        class Dates:
            def to_pylist(self): return [dt.date(2025, 1, 1)]
        class Frame:
            def to_dict(self, mode): self.assert_mode = mode; return [ROW]
        class Filings:
            data = types.SimpleNamespace(column=lambda name: Dates())
            def to_pandas(self): return Frame()
        class Company:
            def __init__(self, cik): self.cik = cik; calls.append(cik)
            def get_filings(self, **kwargs): calls.append(kwargs); return Filings()
        with patch.dict(sys.modules, {'edgar': types.SimpleNamespace(Company=Company)}):
            rows = m.collect_company(TARGET, '2026-04-24', '2026-10-21', 40)
        self.assertEqual(calls[0], 320193)
        self.assertTrue(all(c['trigger_full_load'] is False for c in calls[1:]))
        self.assertEqual(rows[0]['filed'], '2026-07-31')


if __name__ == '__main__': unittest.main()
