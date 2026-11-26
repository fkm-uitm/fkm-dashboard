"""
Transform data/profiles_raw.json (scraper output) into dashboard-ready JSON files
in docs/data/:

  expert_staff.json      — one record per staff member (h-index, counts)
  expert_pubs.json       — flat list of all publications
  expert_grants.json     — flat list of all individual grants
  expert_summary.json    — aggregate totals

Usage:
    python scripts/transform_expert.py
"""

import json
from pathlib import Path
from datetime import date

REPO = Path(__file__).parent.parent
RAW  = REPO / "data" / "profiles_raw.json"
OUT  = REPO / "docs" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def main():
    if not RAW.exists():
        print(f"ERROR: {RAW} not found. Run scraper_expert.py first.")
        return

    profiles: list[dict] = json.loads(RAW.read_text(encoding="utf-8"))
    print(f"Loaded {len(profiles)} profiles")

    staff_rows = []
    pub_rows   = []
    grant_rows = []

    for p in profiles:
        slug = p.get("slug", "")

        # ── staff record ──────────────────────────────────────────────────
        indexed_count = p.get("pubs_indexed", 0)
        other_count   = p.get("pubs_other", 0)

        staff_rows.append({
            "slug":               slug,
            "name":               p.get("name", ""),
            "email":              p.get("email", ""),
            "position":           p.get("position", ""),
            "department":         p.get("department", ""),
            "service_date":       p.get("service_date", ""),
            "h_scopus":           p.get("h_scopus"),
            "h_wos":              p.get("h_wos"),
            "h_gs":               p.get("h_gs"),
            "scopus_id":          p.get("scopus_id", ""),
            "scholar_id":         p.get("scholar_id", ""),
            "orcid":              p.get("orcid", ""),
            "grants_intl_active":      p.get("grants_intl_active", 0),
            "grants_intl_completed":   p.get("grants_intl_completed", 0),
            "grants_natl_active":      p.get("grants_natl_active", 0),
            "grants_natl_completed":   p.get("grants_natl_completed", 0),
            "grants_total":       len(p.get("grants", [])),
            "grants_active":      sum(1 for g in p.get("grants", []) if g.get("status", "").upper() == "ACTIVE"),
            "pubs_indexed":       indexed_count,
            "pubs_other":         other_count,
            "pubs_total":         indexed_count + other_count,
            "phd_graduated":      p.get("phd_graduated", 0),
            "phd_ongoing":        p.get("phd_ongoing", 0),
            "master_graduated":   p.get("master_graduated", 0),
            "master_ongoing":     p.get("master_ongoing", 0),
            "consultancy_appointed": p.get("consultancy_appointed", 0),
            "consultancy_completed": p.get("consultancy_completed", 0),
        })

        # ── publications ──────────────────────────────────────────────────
        for pub in p.get("publications", []):
            group = pub.get("group", "")
            pub_rows.append({
                "slug":    slug,
                "name":    p.get("name", ""),
                "ref":     pub.get("ref", ""),
                "title":   pub.get("title", ""),
                "date":    pub.get("date", ""),
                "type":    pub.get("type", ""),
                "group":   group,
                "indexed": "INDEXED" in group.upper(),
                "url":     pub.get("url", ""),
            })

        # ── grants ────────────────────────────────────────────────────────
        for g in p.get("grants", []):
            grant_rows.append({
                "slug":       slug,
                "name":       p.get("name", ""),
                "title":      g.get("title", ""),
                "level":      g.get("level", ""),
                "file_no":    g.get("file_no", ""),
                "year_start": g.get("year_start"),
                "year_end":   g.get("year_end"),
                "grant_name": g.get("grant_name", ""),
                "grant_code": g.get("grant_code", ""),
                "role":       g.get("role", ""),
                "cost":       g.get("cost"),
                "status":     g.get("status", ""),
            })

    # ── summary ───────────────────────────────────────────────────────────
    summary = {
        "generated":          date.today().isoformat(),
        "staff_count":        len(staff_rows),
        "pubs_indexed_total": sum(s["pubs_indexed"] for s in staff_rows),
        "pubs_other_total":   sum(s["pubs_other"]   for s in staff_rows),
        "grants_active":      sum(s["grants_active"] for s in staff_rows),
        "grants_total":       sum(s["grants_total"]  for s in staff_rows),
        "h_scopus_avg":       _avg([s["h_scopus"] for s in staff_rows if s["h_scopus"] is not None]),
        "phd_total":          sum(s["phd_graduated"] + s["phd_ongoing"] for s in staff_rows),
        "master_total":       sum(s["master_graduated"] + s["master_ongoing"] for s in staff_rows),
        "consultancy_total":  sum(s["consultancy_completed"] for s in staff_rows),
    }

    # ── write ─────────────────────────────────────────────────────────────
    _write("expert_staff.json",   staff_rows)
    _write("expert_pubs.json",    pub_rows)
    _write("expert_grants.json",  grant_rows)
    _write("expert_summary.json", summary)

    print(f"expert_staff.json  : {len(staff_rows)} records")
    print(f"expert_pubs.json   : {len(pub_rows)} records")
    print(f"expert_grants.json : {len(grant_rows)} records")
    print(f"expert_summary.json: {summary}")


def _write(filename: str, data):
    path = OUT / filename
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"→ {path}")


def _avg(values: list) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


if __name__ == "__main__":
    main()
