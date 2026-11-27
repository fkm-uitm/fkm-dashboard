"""
validate_data.py
================
Sanity-check for docs/data/ JSON files produced by both pipelines.
Exits 1 if any check fails; exits 0 if everything looks healthy.

Run after every data fetch or scrape step to guard published data.
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent
DATA = REPO / "docs" / "data"

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        fail(f"{path.name}: cannot parse JSON — {e}")
        return None


# ── Google Sheets pipeline ────────────────────────────────────────────────────

REQUIRED_SHEETS = ("summary.json", "staff.json", "publications.json", "projects.json")
for fname in REQUIRED_SHEETS:
    if not (DATA / fname).exists():
        fail(f"Missing required file: {fname}")

if (DATA / "summary.json").exists():
    s = load_json(DATA / "summary.json")
    if s:
        staff_total = s.get("staff", {}).get("total", 0)
        pub_unique  = s.get("publications", {}).get("total_unique", 0)
        pi_total    = s.get("projects", {}).get("total_pi", 0)
        if staff_total < 50:
            fail(f"summary.json: staff.total={staff_total} (expected ≥ 50)")
        if pub_unique < 10:
            fail(f"summary.json: publications.total_unique={pub_unique} (expected ≥ 10)")
        if pi_total < 1:
            fail(f"summary.json: projects.total_pi={pi_total} (expected ≥ 1)")

if (DATA / "staff.json").exists():
    rows = load_json(DATA / "staff.json")
    if rows is not None:
        if len(rows) < 50:
            fail(f"staff.json: {len(rows)} rows (expected ≥ 50)")
        elif rows and "fullname" not in rows[0]:
            fail("staff.json: first record is missing 'fullname' field")

if (DATA / "publications.json").exists():
    rows = load_json(DATA / "publications.json")
    if rows is not None:
        if len(rows) < 10:
            fail(f"publications.json: {len(rows)} rows (expected ≥ 10)")
        elif rows and "title" not in rows[0]:
            fail("publications.json: first record is missing 'title' field")

# ── Expert portal pipeline ────────────────────────────────────────────────────

REQUIRED_EXPERT = (
    "expert_staff.json",
    "expert_pubs.json",
    "expert_grants.json",
    "expert_summary.json",
)
expert_present = all((DATA / f).exists() for f in REQUIRED_EXPERT)

if expert_present:
    ex = load_json(DATA / "expert_summary.json")
    if ex:
        sc = ex.get("staff_count", 0)
        pi = ex.get("pubs_indexed_total", 0)
        if sc < 10:
            fail(f"expert_summary.json: staff_count={sc} (expected ≥ 10)")
        if pi < 100:
            fail(f"expert_summary.json: pubs_indexed_total={pi} (expected ≥ 100)")

    ex_staff = load_json(DATA / "expert_staff.json")
    if ex_staff is not None:
        if len(ex_staff) < 10:
            fail(f"expert_staff.json: {len(ex_staff)} rows (expected ≥ 10)")
        elif ex_staff and not ("slug" in ex_staff[0] and "name" in ex_staff[0]):
            fail("expert_staff.json: first record missing 'slug' or 'name' field")

# ── Monthly reports ────────────────────────────────────────────────────────────

idx_path = DATA / "reports" / "index.json"
if idx_path.exists():
    idx = load_json(idx_path)
    if idx is not None and not isinstance(idx, list):
        fail("reports/index.json: expected a JSON array")

# ── Result ────────────────────────────────────────────────────────────────────

if errors:
    print("VALIDATION FAILED:", file=sys.stderr)
    for msg in errors:
        print(f"  ✗ {msg}", file=sys.stderr)
    sys.exit(1)

print(f"OK: All validation checks passed ({len(REQUIRED_SHEETS) + len(REQUIRED_EXPERT)} files checked).")
