"""
One-time script: download staff profile photos from UiTM Expert portal.

Fetches PR_RS_IMG for every slug in data/members.csv, downloads the image
(skipping the generic default avatar), and saves it to:

    docs/images/staff/<slug>.<ext>

Re-running is safe — existing files are skipped unless --force is passed.

Usage:
    python scripts/download_photos.py           # skip already-downloaded
    python scripts/download_photos.py --force   # re-download all
"""

import csv
import json
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_URL    = "https://expert.uitm.edu.my/expert/{slug}"
DEFAULT_IMG = "profile_default.png"
HEADERS     = {"User-Agent": "FKM-Dashboard-Bot/1.0 (internal; contact halim471@uitm.edu.my)"}
DELAY       = 1.5   # seconds between requests
OUT_DIR     = Path(__file__).parent.parent / "docs" / "images" / "staff"


def get_photo_url(slug: str) -> str | None:
    url = BASE_URL.format(slug=slug)
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except Exception as e:
        print(f"  [warn] fetch failed: {e}", flush=True)
        return None

    soup   = BeautifulSoup(r.text, "html.parser")
    script = soup.find("script", {"data-page": True})
    if not script or not script.string:
        return None

    try:
        props = json.loads(script.string)["props"]
        return props.get("p_profile", {}).get("PR_RS_IMG")
    except Exception as e:
        print(f"  [warn] parse error: {e}", flush=True)
        return None


def download_image(photo_url: str, dest: Path) -> bool:
    try:
        r = requests.get(photo_url, headers=HEADERS, timeout=20, stream=True)
        r.raise_for_status()
        dest.write_bytes(r.content)
        size_kb = len(r.content) // 1024
        print(f"  -> saved {dest.name} ({size_kb} KB)", flush=True)
        return True
    except Exception as e:
        print(f"  [warn] download failed: {e}", flush=True)
        return False


def main():
    force = "--force" in sys.argv
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    repo_root   = Path(__file__).parent.parent
    members_csv = repo_root / "data" / "members.csv"
    if not members_csv.exists():
        print(f"ERROR: {members_csv} not found.")
        sys.exit(1)

    with open(members_csv, newline="", encoding="utf-8") as f:
        slugs = [row["slug"].strip() for row in csv.DictReader(f)
                 if row.get("slug", "").strip() and not row["slug"].startswith("#")]

    print(f"Processing {len(slugs)} staff members…", flush=True)
    downloaded = skipped = no_photo = errors = 0

    for i, slug in enumerate(slugs, 1):
        print(f"\n[{i}/{len(slugs)}] {slug}", flush=True)

        # Check if already downloaded (any extension)
        existing = list(OUT_DIR.glob(f"{slug}.*"))
        if existing and not force:
            print(f"  already have {existing[0].name}, skipping", flush=True)
            skipped += 1
            continue

        photo_url = get_photo_url(slug)

        if not photo_url or DEFAULT_IMG in photo_url or photo_url.endswith("None"):
            print(f"  no custom photo", flush=True)
            no_photo += 1
        else:
            ext  = Path(photo_url).suffix or ".jpg"
            dest = OUT_DIR / f"{slug}{ext}"
            ok   = download_image(photo_url, dest)
            if ok:
                downloaded += 1
            else:
                errors += 1

        if i < len(slugs):
            time.sleep(DELAY)

    print(f"\nDone.")
    print(f"  Downloaded : {downloaded}")
    print(f"  No photo   : {no_photo}")
    print(f"  Skipped    : {skipped}")
    print(f"  Errors     : {errors}")
    print(f"  Images in  : {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
