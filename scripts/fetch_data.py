"""
fetch_data.py
=============
Fetches all sheets from the FKM Research Google Spreadsheet (public CSV export),
processes the data, and writes JSON files to docs/data/ for the static dashboard.

Usage:
    python scripts/fetch_data.py

Requirements:
    pip install requests pandas
"""

import requests
import pandas as pd
import json
import re
import os
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────────────
SHEET_ID = "1qCyJ2V1CfCpXOo2EulT0bxBpYLQ0Jq6QEae5490_xdI"
OUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "docs", "data")

# Sheet GIDs (from the Google Sheets URL when clicking each tab)
SHEETS = {
    "pi":    0,        # Masterlist PI
    "grant": 492988248,  # Masterlist Grant
    "pub":   1543655237, # Masterlist Pub
    "staff": 1693068791, # Masterlist Staff
}

os.makedirs(OUT_DIR, exist_ok=True)

def csv_url(gid):
    return f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"

def fetch_sheet(name, gid):
    url = csv_url(gid)
    print(f"  Fetching {name} (gid={gid})...")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    from io import StringIO
    df = pd.read_csv(StringIO(r.text), dtype=str)
    df = df.fillna("")
    # Strip whitespace from all string columns
    df = df.apply(lambda col: col.str.strip() if col.dtype == "object" else col)
    return df

def clean_money(val):
    """Parse RM strings like '20,000.00' or '########' → float or None."""
    if not val or val.strip() in ("", "-", "########", "#######", "N/A"):
        return None
    cleaned = re.sub(r"[^0-9.]", "", val)
    try:
        return float(cleaned)
    except ValueError:
        return None

def safe_str(val):
    return str(val).strip() if val and str(val).strip() not in ("-", "#REF!", "#N/A", "########", "#######") else ""

# ── FETCH ALL SHEETS ──────────────────────────────────────────────────────────
print("Fetching sheets from Google Sheets...")
dfs = {}
for name, gid in SHEETS.items():
    try:
        dfs[name] = fetch_sheet(name, gid)
        print(f"    ✓ {name}: {len(dfs[name])} rows, {len(dfs[name].columns)} cols")
    except Exception as e:
        print(f"    ✗ {name}: {e}")
        dfs[name] = pd.DataFrame()

# ── PROCESS: PI ───────────────────────────────────────────────────────────────
pi_df = dfs.get("pi", pd.DataFrame())
pi_records = []
pi_total_alloc = 0.0

if not pi_df.empty:
    for _, row in pi_df.iterrows():
        alloc = clean_money(row.get("PERUNTUKKAN DILULUSKAN (RM)", ""))
        if alloc:
            pi_total_alloc += alloc
        pi_records.append({
            "no_fail":    safe_str(row.get("NO. FAIL", "")),
            "title":      safe_str(row.get("TAJUK PENYELIDIKAN", "")),
            "pi":         safe_str(row.get("KETUA PROJEK", "")),
            "grant_name": safe_str(row.get("NAMA GERAN", "")),
            "sponsor":    safe_str(row.get("PENAJA", "")),
            "category":   safe_str(row.get("KATEGORI PENAJA", "")),
            "start":      safe_str(row.get("TARIKH MULA", "")),
            "end":        safe_str(row.get("TARIKH TAMAT", "")),
            "status":     safe_str(row.get("STATUS", "")),
            "allocation": alloc,
            "type":       "PI",
        })

# ── PROCESS: GRANT ────────────────────────────────────────────────────────────
grant_df = dfs.get("grant", pd.DataFrame())
grant_records = []
grant_total_alloc = 0.0

if not grant_df.empty:
    for _, row in grant_df.iterrows():
        alloc = clean_money(row.get("PERUNTUKKAN DILULUSKAN (RM)", ""))
        if alloc:
            grant_total_alloc += alloc
        grant_records.append({
            "no_fail":    safe_str(row.get("NO. FAIL", "")),
            "title":      safe_str(row.get("TAJUK PENYELIDIKAN", "")),
            "pi":         safe_str(row.get("KETUA PROJEK", "")),
            "grant_name": safe_str(row.get("NAMA GERAN", "")),
            "sponsor":    safe_str(row.get("PENAJA", "")),
            "category":   safe_str(row.get("KATEGORI PENAJA", "")),
            "start":      safe_str(row.get("TARIKH MULA", "")),
            "end":        safe_str(row.get("TARIKH TAMAT", "")),
            "status":     safe_str(row.get("STATUS", "")),
            "allocation": alloc,
            "type":       "Grant",
        })

all_projects = pi_records + grant_records

# ── PROCESS: PUBLICATIONS ─────────────────────────────────────────────────────
pub_df = dfs.get("pub", pd.DataFrame())
pub_records = []

if not pub_df.empty:
    for _, row in pub_df.iterrows():
        pub_records.append({
            "pub_id":       safe_str(row.get("PUB_ID", "")),
            "ref_no":       safe_str(row.get("REF_NO", "")),
            "group":        safe_str(row.get("PUB_GROUP_NAME", "")),
            "type":         safe_str(row.get("PUBLICATION_TYPE", "")),
            "status":       safe_str(row.get("STATUS_NAME", "")),
            "title":        safe_str(row.get("TITLE", "")),
            "pub_date":     safe_str(row.get("PUB_DATE", "")),
            "level":        safe_str(row.get("PUBLICATION_LEVEL", "")),
            "doi":          safe_str(row.get("DOI", "")),
            "publisher":    safe_str(row.get("PUBLISHER", "")),
            "volume":       safe_str(row.get("VOLUME", "")),
            "issues":       safe_str(row.get("ISSUES", "")),
            "staff_id":     safe_str(row.get("STAFF_ID", "")),
            "author_name":  safe_str(row.get("NAME", "")),
            "author_type":  safe_str(row.get("AUTHOR_TYPE_NAME", "")),
            "index_name":   safe_str(row.get("INDEX_NAME", "")),
            "jcr_quartile": safe_str(row.get("JCR_QUARTILE", "")),
            "faculty":      safe_str(row.get("FACULTY", "")),
        })

# Unique publications by PUB_ID
unique_pub_ids = list({r["pub_id"] for r in pub_records if r["pub_id"]})
# For unique pub stats, pick first occurrence per PUB_ID
seen = set()
unique_pubs = []
for r in pub_records:
    if r["pub_id"] and r["pub_id"] not in seen:
        seen.add(r["pub_id"])
        unique_pubs.append(r)

# ── PROCESS: STAFF ────────────────────────────────────────────────────────────
staff_df = dfs.get("staff", pd.DataFrame())
staff_records = []

if not staff_df.empty:
    for _, row in staff_df.iterrows():
        staff_records.append({
            "staff_id":        safe_str(row.get("STAFFID", "")),
            "fullname":        safe_str(row.get("FULLNAME", "")),
            "email":           safe_str(row.get("EMAIL", "")),
            "designation":     safe_str(row.get("DESIGNATION", "")),
            "permanent_faculty": safe_str(row.get("PERMENANT FACULTY", "")),
            "present_faculty": safe_str(row.get("PRESENT FACULTY", "")),
            "position":        safe_str(row.get("POSITION", "")),
            "current_position": safe_str(row.get("CURRENT POSITION", "")),
        })

# ── COMPUTE SUMMARY KPIs ──────────────────────────────────────────────────────
def count_by(records, key):
    result = {}
    for r in records:
        v = r.get(key, "") or "Unknown"
        result[v] = result.get(v, 0) + 1
    return dict(sorted(result.items(), key=lambda x: -x[1]))

# Publications
pub_by_group  = count_by(unique_pubs, "group")
pub_by_type   = count_by(unique_pubs, "type")
pub_by_index  = count_by([r for r in unique_pubs if r["index_name"]], "index_name")
pub_by_q      = count_by([r for r in unique_pubs if r["jcr_quartile"] and r["jcr_quartile"] not in ("", "-")], "jcr_quartile")
pub_by_level  = count_by(unique_pubs, "level")

# Projects
proj_by_status   = count_by(all_projects, "status")
proj_by_category = count_by(all_projects, "category")
proj_by_type     = count_by(all_projects, "type")

# Staff
staff_by_position    = count_by(staff_records, "position")
staff_by_designation = count_by(staff_records, "designation")

summary = {
    "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    "snapshot":     "Live from Google Sheets",
    "publications": {
        "total_rows":        len(pub_records),
        "total_unique":      len(unique_pubs),
        "by_group":          pub_by_group,
        "by_type":           pub_by_type,
        "by_index":          pub_by_index,
        "by_quartile":       pub_by_q,
        "by_level":          pub_by_level,
    },
    "projects": {
        "total_pi":          len(pi_records),
        "total_grant":       len(grant_records),
        "total":             len(all_projects),
        "pi_allocation":     round(pi_total_alloc, 2),
        "grant_allocation":  round(grant_total_alloc, 2),
        "total_allocation":  round(pi_total_alloc + grant_total_alloc, 2),
        "by_status":         proj_by_status,
        "by_category":       proj_by_category,
        "by_type":           proj_by_type,
    },
    "staff": {
        "total":             len(staff_records),
        "by_position":       staff_by_position,
        "by_designation":    staff_by_designation,
    },
}

# ── WRITE JSON FILES ──────────────────────────────────────────────────────────
def write_json(filename, data):
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Written: docs/data/{filename} ({os.path.getsize(path)//1024} KB)")

print("\nWriting JSON data files...")
write_json("summary.json",  summary)
write_json("projects.json", all_projects)
write_json("publications.json", pub_records)
write_json("staff.json",    staff_records)

print(f"""
Done.
  Publications : {len(unique_pubs)} unique ({len(pub_records)} rows)
  Projects     : {len(all_projects)} total (PI: {len(pi_records)}, Grant: {len(grant_records)})
  Staff        : {len(staff_records)} records
  Total alloc  : RM {pi_total_alloc + grant_total_alloc:,.2f}
""")
