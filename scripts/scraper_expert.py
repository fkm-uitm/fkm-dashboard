"""
Scrape staff profiles from https://expert.uitm.edu.my/expert/{slug}
and save raw data to data/profiles_raw.json.

Usage:
    python scripts/scraper_expert.py               # all members in data/members.csv
    python scripts/scraper_expert.py halim471       # single slug (test)

The site is server-side rendered — plain requests + BeautifulSoup, no JS needed.
Publications are paginated; we follow ?indexed_page=N and ?other_page=N.
"""

import csv
import json
import re
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
DELAY_PROFILE = 2.0   # seconds between staff members
DELAY_PAGE    = 1.0   # seconds between pagination requests


# ── helpers ────────────────────────────────────────────────────────────────

def get_soup(url: str, params: dict | None = None) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as exc:
        print(f"  [warn] fetch failed: {url} — {exc}", flush=True)
        return None


def text(el) -> str:
    return el.get_text(" ", strip=True) if el else ""


# ── profile-level fields ────────────────────────────────────────────────────

def parse_hindex(soup: BeautifulSoup) -> dict:
    """Extract h-index values (Scopus / WoS / Google Scholar)."""
    result = {}
    # The h-index cards share a common pattern: big number followed by label
    # e.g. <div class="...">13</div> <div>Scopus</div>
    for card in soup.select("[class*='text-center'], [class*='card']"):
        t = card.get_text(" ", strip=True)
        m = re.match(r"(\d+)\s*(Scopus|WoS|Google Scholar)", t, re.I)
        if m:
            key = m.group(2).lower().replace(" ", "_")
            result[f"h_{key}"] = int(m.group(1))
    return result


def parse_profile_header(soup: BeautifulSoup) -> dict:
    """Name, title, email, position, department, service date."""
    data: dict = {}
    # Name from <title> tag
    title_tag = soup.find("title")
    if title_tag:
        name = title_tag.get_text(" ", strip=True).replace("- UiTM Expert", "").strip()
        data["name"] = name

    page_text = soup.get_text(" ", strip=True)

    # Email — look for @uitm.edu.my
    m = re.search(r"[\w.+-]+@uitm\.edu\.my", page_text)
    data["email"] = m.group(0) if m else ""
    data["slug"] = data["email"].split("@")[0] if data["email"] else ""

    # H-index — three numbers before "Scopus", "WoS", "Google Scholar"
    for label, key in [("Scopus", "h_scopus"), ("WoS", "h_wos"), ("Google Scholar", "h_gs")]:
        m = re.search(r"(\d+)\s+" + re.escape(label), page_text)
        data[key] = int(m.group(1)) if m else None

    # Scopus / Scholar IDs and ORCID
    m = re.search(r"scopus\.com/authid/detail\.uri\?authorId=(\d+)", str(soup), re.I)
    data["scopus_id"] = m.group(1) if m else ""

    m = re.search(r"scholar\.google\.com/citations\?user=([\w-]+)", str(soup), re.I)
    data["scholar_id"] = m.group(1) if m else ""

    m = re.search(r"orcid\.org/([\d-]{16,20})", str(soup))
    data["orcid"] = m.group(1) if m else ""

    # Position / department / service date — look for labelled spans
    for label, key in [
        ("Permanent Position", "position"),
        ("Current Department", "department"),
        ("Start Service Date", "service_date"),
    ]:
        idx = page_text.find(label)
        if idx >= 0:
            snippet = page_text[idx + len(label) : idx + len(label) + 80].strip()
            data[key] = snippet.split("  ")[0].strip()

    return data


# ── grants ──────────────────────────────────────────────────────────────────

def parse_grant_counts(soup: BeautifulSoup) -> dict:
    """International/National active/completed counts from the summary row."""
    text_full = soup.get_text(" ", strip=True)
    result = {}
    for level in ("International", "National"):
        m = re.search(rf"{level}\s+(\d+)\s+Completed\s+(\d+)\s+Active", text_full)
        if m:
            result[f"grants_{level.lower()}_completed"] = int(m.group(1))
            result[f"grants_{level.lower()}_active"] = int(m.group(2))
    return result


def parse_grants(soup: BeautifulSoup) -> list[dict]:
    """Extract individual grant records from the page."""
    grants = []
    # Each grant is a card: title div + meta div with badge (level), File:, Year:, Role:, Status badge
    for card in soup.select(".bg-white.p-3.rounded-2.border"):
        title_el = card.find("div", class_=lambda c: c and "fw-semibold" in c)
        if not title_el:
            continue
        title = title_el.get_text(" ", strip=True)
        meta = card.get_text(" ", strip=True)

        level_el = card.find("span", class_="badge")
        level = text(level_el) if level_el else ""

        file_m = re.search(r"File:\s*([^••]+)", meta)
        year_m = re.search(r"Year:\s*(\d{4})", meta)
        role_m = re.search(r"Role:\s*([^••\n]+)", meta)

        # Last badge (after ms-auto) = status
        badges = card.select("span.badge")
        status = text(badges[-1]) if len(badges) > 1 else ""

        grants.append({
            "title": title,
            "level": level,
            "file_no": file_m.group(1).strip() if file_m else "",
            "year": int(year_m.group(1)) if year_m else None,
            "role": role_m.group(1).strip() if role_m else "",
            "status": status,
        })
    return grants


# ── publications ─────────────────────────────────────────────────────────────

def parse_pubs_on_page(soup: BeautifulSoup) -> list[dict]:
    """Publications visible in the current page soup."""
    pubs = []
    # Publication cards: .bg-white border with Ref: pattern
    for card in soup.select(".bg-white.p-3.rounded-2.border"):
        ref_m = re.search(r"Ref:\s*(PB/[\d/]+)", card.get_text())
        if not ref_m:
            continue
        title_el = card.find("div", class_=lambda c: c and "fw-semibold" in c)
        title = text(title_el)
        badge_el = card.find("span", class_="badge")
        pub_type = text(badge_el).upper()
        pubs.append({
            "ref": ref_m.group(1),
            "title": title,
            "type": "indexed" if "INDEXED" in pub_type else "other",
        })
    return pubs


def get_pub_total(soup: BeautifulSoup) -> tuple[int, int]:
    """Return (indexed_total, other_total) from the publications summary."""
    page_text = soup.get_text(" ", strip=True)
    idx_m = re.search(r"Indexed Publications\s+(\d+)", page_text)
    oth_m = re.search(r"Other Publications\s+(\d+)", page_text)
    indexed = int(idx_m.group(1)) if idx_m else 0
    other = int(oth_m.group(1)) if oth_m else 0
    return indexed, other


def fetch_all_pubs(slug: str, first_soup: BeautifulSoup) -> list[dict]:
    """Fetch all publication pages for a staff member."""
    indexed_total, other_total = get_pub_total(first_soup)
    pubs = parse_pubs_on_page(first_soup)
    print(f"  pubs page 1: {len(pubs)} (target: {indexed_total}i + {other_total}o)", flush=True)

    base_url = BASE_URL.format(slug=slug)

    # Publications show 5 per page-type. Iterate indexed pages then other pages.
    # Page 1 of each is already in first_soup; start from page 2.
    per_page = 5
    indexed_pages = max(0, (indexed_total - 1) // per_page)  # extra pages beyond page 1
    other_pages   = max(0, (other_total   - 1) // per_page)

    for p in range(2, indexed_pages + 2):
        time.sleep(DELAY_PAGE)
        s = get_soup(base_url, {"indexed_page": p})
        if s:
            new = parse_pubs_on_page(s)
            pubs.extend(new)
            print(f"  indexed page {p}: +{len(new)}", flush=True)

    for p in range(2, other_pages + 2):
        time.sleep(DELAY_PAGE)
        s = get_soup(base_url, {"other_page": p})
        if s:
            new = parse_pubs_on_page(s)
            pubs.extend(new)
            print(f"  other page {p}: +{len(new)}", flush=True)

    # Deduplicate by ref
    seen = set()
    deduped = []
    for pub in pubs:
        if pub["ref"] not in seen:
            seen.add(pub["ref"])
            deduped.append(pub)

    print(f"  total pubs: {len(deduped)}", flush=True)
    return deduped


# ── supervision ──────────────────────────────────────────────────────────────

def parse_supervision(soup: BeautifulSoup) -> dict:
    page_text = soup.get_text(" ", strip=True)
    result = {}
    for deg in ("PhD", "Master"):
        m = re.search(rf"{deg}\s+(\d+)\s+Graduated\s+(\d+)\s+Ongoing", page_text)
        if m:
            result[f"{deg.lower()}_graduated"] = int(m.group(1))
            result[f"{deg.lower()}_ongoing"] = int(m.group(2))
    return result


def parse_consultancy(soup: BeautifulSoup) -> dict:
    page_text = soup.get_text(" ", strip=True)
    m = re.search(r"Consultancy Projects\s+Appointed\s+(\d+)\s+Completed\s+(\d+)", page_text)
    if m:
        return {"consultancy_appointed": int(m.group(1)), "consultancy_completed": int(m.group(2))}
    return {}


# ── main scraper ─────────────────────────────────────────────────────────────

def scrape_profile(slug: str) -> dict | None:
    url = BASE_URL.format(slug=slug)
    print(f"Fetching {url}", flush=True)
    soup = get_soup(url)
    if not soup:
        return None

    profile = {"slug": slug}
    profile.update(parse_profile_header(soup))
    profile.update(parse_grant_counts(soup))
    profile["grants"] = parse_grants(soup)
    profile.update(parse_supervision(soup))
    profile.update(parse_consultancy(soup))
    profile["publications"] = fetch_all_pubs(slug, soup)
    return profile


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
            print(f"ERROR: {members_csv} not found. Create it with slug column.", flush=True)
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
