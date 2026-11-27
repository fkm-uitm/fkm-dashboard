"""
Generate a pre-computed monthly progress report snapshot.

Usage:
    python scripts/generate_monthly_report.py           # current month
    python scripts/generate_monthly_report.py 2026-11  # specific period
"""

import json
import sys
from pathlib import Path
from datetime import date
from collections import defaultdict

REPO = Path(__file__).parent.parent
OUT  = REPO / "docs" / "data" / "reports"
OUT.mkdir(parents=True, exist_ok=True)

MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
]
SWE           = {"SCOPUS", "WEB OF SCIENCE", "ERA"}
INDEXED_TYPES = {"JOURNAL", "PROCEEDING"}


def _print(s): print(s, flush=True)


def main():
    period = sys.argv[1] if len(sys.argv) > 1 else date.today().strftime("%Y-%m")
    year, month = map(int, period.split("-"))
    period_label = f"{MONTHS[month - 1]} {year}"
    _print(f"Generating report for {period_label} ({period})")

    # ── load data ─────────────────────────────────────────────────────────
    pubs    = json.loads((REPO/"docs/data/expert_pubs.json").read_text(encoding="utf-8"))
    staff   = json.loads((REPO/"docs/data/expert_staff.json").read_text(encoding="utf-8"))
    grants  = json.loads((REPO/"docs/data/expert_grants.json").read_text(encoding="utf-8"))
    summary = json.loads((REPO/"docs/data/expert_summary.json").read_text(encoding="utf-8"))

    # ── filter pubs to ≤ this period ──────────────────────────────────────
    def pub_month(p):
        return (p.get("date") or "")[:7]  # "YYYY-MM" or ""

    pubs_in = [p for p in pubs if pub_month(p) and pub_month(p) <= period]
    indexed  = [p for p in pubs_in if p.get("indexed") and
                p.get("type","").upper() in INDEXED_TYPES]

    # ── all-time unique title sets ─────────────────────────────────────────
    swe_titles = {p["title"].strip().lower() for p in indexed
                  if p.get("index_name","") in SWE and p["title"].strip()}
    all_titles = {p["title"].strip().lower() for p in indexed if p["title"].strip()}

    # ── by year (unique titles per year, 2015+) ───────────────────────────
    yr_swe: dict[str,set] = defaultdict(set)
    yr_all: dict[str,set] = defaultdict(set)
    for p in indexed:
        y = (p.get("date") or "")[:4]
        t = p["title"].strip().lower()
        if y >= "2015" and t:
            yr_all[y].add(t)
            if p.get("index_name","") in SWE:
                yr_swe[y].add(t)
    pubs_by_year = {y: {"swe": len(yr_swe[y]), "all": len(yr_all[y])}
                    for y in sorted(yr_all)}

    # ── YTD by month (current year only) ──────────────────────────────────
    mo_swe: dict[str,set] = defaultdict(set)
    mo_all: dict[str,set] = defaultdict(set)
    for p in indexed:
        m = pub_month(p)
        t = p["title"].strip().lower()
        if m[:4] == str(year) and m <= period and t:
            mo_all[m].add(t)
            if p.get("index_name","") in SWE:
                mo_swe[m].add(t)
    pubs_ytd_swe = sum(len(v) for v in mo_swe.values())
    pubs_ytd_all = sum(len(v) for v in mo_all.values())
    pubs_by_month_ytd = [{"month": m, "swe": len(mo_swe[m]), "all": len(mo_all[m])}
                         for m in sorted(set(mo_swe) | set(mo_all))]

    # ── index breakdown (unique titles) ───────────────────────────────────
    idx_titles: dict[str,set] = defaultdict(set)
    for p in indexed:
        t = p["title"].strip().lower()
        if t:
            idx_titles[p.get("index_name","OTHER")].add(t)
    index_breakdown = {k: len(v) for k, v in idx_titles.items()}

    # ── grants breakdown ───────────────────────────────────────────────────
    intl_active = intl_comp = natl_active = natl_comp = 0
    for g in grants:
        level  = (g.get("level","") or "").upper()
        status = (g.get("status","") or "").upper()
        intl   = "INT" in level
        active = status == "ACTIVE"
        if intl:
            if active: intl_active += 1
            else:      intl_comp   += 1
        else:
            if active: natl_active += 1
            else:      natl_comp   += 1

    # ── by department ─────────────────────────────────────────────────────
    slug_dept = {s["slug"]: (s.get("department","") or "Unknown") for s in staff}
    dept_staff:  dict[str,int] = defaultdict(int)
    dept_ga:     dict[str,int] = defaultdict(int)
    dept_swe:    dict[str,set] = defaultdict(set)
    dept_all:    dict[str,set] = defaultdict(set)
    for s in staff:
        d = slug_dept.get(s["slug"],"Unknown")
        dept_staff[d] += 1
        dept_ga[d]    += s.get("grants_active", 0)
    for p in indexed:
        d = slug_dept.get(p.get("slug",""),"Unknown")
        t = p["title"].strip().lower()
        if t:
            dept_all[d].add(t)
            if p.get("index_name","") in SWE:
                dept_swe[d].add(t)
    all_depts = set(dept_staff) | set(dept_swe)
    by_dept = sorted(
        [{"dept": d, "staff": dept_staff[d],
          "indexed_swe": len(dept_swe[d]), "indexed_all": len(dept_all[d]),
          "grants_active": dept_ga[d]}
         for d in all_depts],
        key=lambda x: -x["indexed_swe"],
    )

    # ── top staff ──────────────────────────────────────────────────────────
    top_staff = sorted(
        [{"slug": s["slug"], "name": s["name"],
          "dept": s.get("department",""), "h_scopus": s.get("h_scopus"),
          "pubs_scopus_wos_era": s["pubs_scopus_wos_era"]}
         for s in staff if s.get("pubs_scopus_wos_era",0) > 0],
        key=lambda x: -x["pubs_scopus_wos_era"],
    )[:20]

    # ── key findings (auto-generated prose) ───────────────────────────────
    h_vals = [s["h_scopus"] for s in staff if s.get("h_scopus") is not None]
    h_avg  = round(sum(h_vals)/len(h_vals), 1) if h_vals else None
    h_max  = max(h_vals) if h_vals else None

    findings = []
    if pubs_ytd_swe:
        findings.append(
            f"<b>{pubs_ytd_swe}</b> unique Scopus/WoS/ERA papers recorded in {year} "
            f"up to {period_label} ({pubs_ytd_all} total indexed, including MyCite)."
        )
    findings.append(
        f"Cumulative all-time total of <b>{len(swe_titles):,}</b> unique Scopus/WoS/ERA "
        f"publications — the primary PRIME-aligned indexed count."
    )
    if intl_active or natl_active:
        findings.append(
            f"<b>{intl_active + natl_active}</b> active grants "
            f"({intl_active} international, {natl_active} national) "
            f"across {len(staff)} staff members."
        )
    if h_avg is not None:
        findings.append(
            f"Mean Scopus h-index is <b>{h_avg}</b> across {len(h_vals)} staff with "
            f"Scopus profiles; highest individual h-index is <b>{h_max}</b>."
        )
    sv = summary.get("phd_total",0) + summary.get("master_total",0)
    if sv:
        findings.append(
            f"<b>{summary.get('phd_total',0)}</b> PhD and "
            f"<b>{summary.get('master_total',0)}</b> Master's students supervised "
            f"(graduated and ongoing combined)."
        )

    # ── assemble report ───────────────────────────────────────────────────
    report = {
        "period":        period,
        "period_label":  period_label,
        "generated":     date.today().isoformat(),
        "summary": {
            "staff_count":       len(staff),
            "pubs_indexed_swe":  len(swe_titles),
            "pubs_indexed_all":  len(all_titles),
            "pubs_other":        summary.get("pubs_other_total", 0),
            "grants_active":     intl_active + natl_active,
            "grants_total":      len(grants),
            "h_scopus_avg":      h_avg,
            "phd_total":         summary.get("phd_total", 0),
            "master_total":      summary.get("master_total", 0),
            "consultancy_total": summary.get("consultancy_total", 0),
        },
        "pubs_ytd_swe":       pubs_ytd_swe,
        "pubs_ytd_all":       pubs_ytd_all,
        "pubs_by_year":       pubs_by_year,
        "pubs_by_month_ytd":  pubs_by_month_ytd,
        "index_breakdown":    index_breakdown,
        "grants_by_level": {
            "International": {"active": intl_active, "completed": intl_comp},
            "National":      {"active": natl_active, "completed": natl_comp},
        },
        "by_dept":     by_dept,
        "top_staff":   top_staff,
        "key_findings": findings,
    }

    # ── write ─────────────────────────────────────────────────────────────
    out_path = OUT / f"{period}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    _print(f"-> {out_path}")

    # update index.json
    idx_path = OUT / "index.json"
    index    = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else []
    index    = [r for r in index if r["period"] != period]
    index.append({"period": period, "period_label": period_label,
                  "generated": date.today().isoformat()})
    index.sort(key=lambda x: x["period"], reverse=True)
    idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    _print(f"-> {idx_path}  ({len(index)} total reports)")


if __name__ == "__main__":
    main()
