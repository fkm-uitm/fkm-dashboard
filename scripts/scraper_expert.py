"""
Scrape staff profiles from https://expert.uitm.edu.my/expert/{slug}
and save raw data to data/profiles_raw.json.

Usage:
    python scripts/scraper_expert.py               # all members in data/members.csv
    python scripts/scraper_expert.py halim471       # single slug (test)

Data is embedded in the page as an Inertia.js JSON blob (<script data-page>).
No pagination or BeautifulSoup HTML parsing needed.
"""

import csv
import json
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://expert.uitm.edu.my/expert/{slug}"
HEADERS = {
    "User-Agent": "FKM-Dashboard-Bot/1.0 (internal faculty research dashboard; contact halim471@uitm.edu.my)",
    "Accept-Language": "en-US,en;q=0.9",
}
DELAY_PROFILE = 2.0  # seconds between staff members


def fetch_props(slug: str) -> dict | None:
    """Fetch Inertia JSON props from a profile page."""
    url = BASE_URL.format(slug=slug)
    print(f"Fetching {url}", flush=True)
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except Exception as exc:
        print(f"  [warn] fetch failed: {url} — {exc}", flush=True)
        return None

    soup = BeautifulSoup(r.text, "html.parser")
    script = soup.find("script", {"data-page": True})
    if not script or not script.string:
        print(f"  [warn] no Inertia data-page script found for {slug}", flush=True)
        return None

    try:
        return json.loads(script.string)["props"]
    except Exception as exc:
        print(f"  [warn] JSON parse error for {slug} — {exc}", flush=True)
        return None


def scrape_profile(slug: str) -> dict | None:
    props = fetch_props(slug)
    if not props:
        return None

    prof   = props.get("p_profile", {})
    links  = props.get("p_profile_pub", {})
    res    = props.get("p_res", {})
    pub    = props.get("p_pub", {})
    con    = props.get("p_con", {})
    sv     = props.get("p_sv", {})

    # Build grant list from all four buckets
    grants = []
    for bucket in ("IC_list", "IA_list", "NC_list", "NA_list"):
        for g in res.get(bucket) or []:
            grants.append({
                "file_no":    g.get("File_No", ""),
                "title":      g.get("Title", "").strip(),
                "year_start": g.get("YearStart"),
                "year_end":   g.get("YearEnd"),
                "grant_name": g.get("grantName", ""),
                "grant_code": g.get("grant_code", ""),
                "role":       g.get("Role", ""),
                "cost":       g.get("Cost"),
                "status":     g.get("Status", ""),
                "level":      g.get("GrantLevel", ""),
            })

    # Build publication list
    pubs = []
    for p in (pub.get("indexed") or []) + (pub.get("others") or []):
        pubs.append({
            "pub_id":   p.get("PUB_ID"),
            "ref":      p.get("REF_NO", ""),
            "title":    p.get("TITLE", "").strip(),
            "date":     p.get("PUB_DATE", "")[:10] if p.get("PUB_DATE") else "",
            "type":     p.get("PUBLICATION_TYPE", ""),
            "group":    p.get("PUB_GROUP_NAME", ""),
            "url":      p.get("URL", ""),
        })

    print(f"  pubs: {pub.get('index_count', 0)}i + {pub.get('other_count', 0)}o | grants: {len(grants)}", flush=True)

    return {
        "slug":              slug,
        "name":              prof.get("NAMA_PENUH", ""),
        "email":             prof.get("EMAIL_UITM", ""),
        "position":          prof.get("JAWATAN_HAKIKI", ""),
        "department":        prof.get("JABATAN_SEKARANG", ""),
        "service_date":      prof.get("YEAR_START", ""),
        "h_scopus":          prof.get("H_INDEX_SCOPUS"),
        "h_wos":             prof.get("H_INDEX_WOS"),
        "h_gs":              prof.get("H_INDEX_GSCHOLAR"),
        "scopus_id":         links.get("prf_scopus", ""),
        "scholar_id":        links.get("prf_gscholar", ""),
        "orcid":             links.get("prf_orchid", ""),
        "grants_intl_completed": res.get("IC", 0),
        "grants_intl_active":    res.get("IA", 0),
        "grants_natl_completed": res.get("NC", 0),
        "grants_natl_active":    res.get("NA", 0),
        "pubs_indexed":      pub.get("index_count", 0),
        "pubs_other":        pub.get("other_count", 0),
        "phd_graduated":     sv.get("phd_grad_count", 0),
        "phd_ongoing":       sv.get("phd_ongoing_count", 0),
        "master_graduated":  sv.get("master_grad_count", 0),
        "master_ongoing":    sv.get("master_ongoing_count", 0),
        "consultancy_appointed":  con.get("appointed_count", 0),
        "consultancy_completed":  con.get("completed_count", 0),
        "grants":       grants,
        "publications": pubs,
    }


def load_members(csv_path: Path) -> list[str]:
    slugs = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            slug = row.get("slug", "").strip()
            if slug and not slug.startswith("#"):
                slugs.append(slug)
    return slugs


def main():
    repo_root = Path(__file__).parent.parent
    out_path = repo_root / "data" / "profiles_raw.json"
    out_path.parent.mkdir(exist_ok=True)

    if len(sys.argv) > 1:
        slugs = sys.argv[1:]
    else:
        members_csv = repo_root / "data" / "members.csv"
        if not members_csv.exists():
            print(f"ERROR: {members_csv} not found.", flush=True)
            sys.exit(1)
        slugs = load_members(members_csv)

    print(f"Scraping {len(slugs)} staff member(s)…", flush=True)
    results = []
    for i, slug in enumerate(slugs, 1):
        print(f"\n[{i}/{len(slugs)}] {slug}", flush=True)
        profile = scrape_profile(slug)
        if profile:
            results.append(profile)
        if i < len(slugs):
            time.sleep(DELAY_PROFILE)

    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDone. {len(results)} profiles → {out_path}", flush=True)


if __name__ == "__main__":
    main()
