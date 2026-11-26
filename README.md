# FKM Research Dashboard

A fully automated, public GitHub Pages dashboard for the Faculty of Mechanical Engineering (FKM), UiTM Shah Alam. Data is sourced from Google Sheets and updated automatically via GitHub Actions.

## Architecture

```
Google Sheets (live data)
       ↓  (GitHub Actions fetches CSV daily)
scripts/fetch_data.py  →  docs/data/*.json
       ↓
docs/index.html  (reads JSON via fetch())
       ↓
GitHub Pages  (public URL, no login needed)
```

## Quick Start (First-Time Setup)

### 1. Fork / Push to GitHub

```bash
git init
git add .
git commit -m "Initial FKM dashboard"
git remote add origin https://github.com/luqmankhailmi/fkm-dashboard.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Set **Source** to `Deploy from a branch`
3. Set **Branch** to `main`, folder to `/docs`
4. Click **Save**

Your dashboard will be live at:
`https://luqmankhailmi.github.io/fkm-dashboard/`

### 3. Make the Google Sheet Public

The workflow fetches the sheet as a public CSV — no API key needed.

1. Open the Google Sheet
2. **File** → **Share** → **Publish to web**
3. Choose **Entire Document** → **CSV** → **Publish**
4. Also set **Share** → **Anyone with the link** → **Viewer**

That's it. The workflow will auto-fetch data on every push and daily at 9 AM MYT.

## How Data Updates Work

### Automatic (Daily)
GitHub Actions runs `scripts/fetch_data.py` every day at 9 AM MYT (1 AM UTC). It fetches all 4 sheets as CSV, computes KPIs, and writes new JSON files to `docs/data/`. The bot commits and pushes the changes automatically.

### Manual Trigger
Go to your repo → **Actions** → **Update Dashboard Data** → **Run workflow**.

### On Every Push
Any push to `main` also triggers a data refresh.

## Repository Structure

```
fkm-dashboard/
├── .github/
│   └── workflows/
│       └── update-data.yml     # GitHub Actions workflow
├── docs/                       # GitHub Pages root
│   ├── index.html              # Dashboard (single HTML file)
│   └── data/                   # Auto-generated JSON (do not edit manually)
│       ├── summary.json
│       ├── projects.json
│       ├── publications.json
│       └── staff.json
├── scripts/
│   └── fetch_data.py           # Data pipeline script
├── requirements.txt
└── README.md
```

## Data Sources (Google Sheets)

| Sheet | GID | Description |
|---|---|---|
| Masterlist PI | `0` | Research projects (PI-led) |
| Masterlist Grant | `492988248` | Consultancy / grant projects |
| Masterlist Pub | `1543655237` | Publications (one row per author) |
| Masterlist Staff | `1693068791` | Staff directory |

Sheet ID: `1qCyJ2V1CfCpXOo2EulT0bxBpYLQ0Jq6QEae5490_xdI`

## Dashboard Tabs

| Tab | Contents |
|---|---|
| 🏠 Overview | KPI tiles, charts by category/status/index/quartile |
| 📖 Publications | Searchable table, filter by group/type/index |
| 💰 Grants & Projects | PI + Grant projects, filter by category/status |
| 👥 Staff | Staff directory, filter by position |

## Customization

### Change the Refresh Schedule
Edit `.github/workflows/update-data.yml`:
```yaml
- cron: '0 1 * * *'   # 1 AM UTC = 9 AM MYT
```
Use [crontab.guru](https://crontab.guru) to pick a schedule.

### Add a New Sheet
In `scripts/fetch_data.py`, add the GID to the `SHEET_GIDS` dict and handle the new data in the script.

### Change Dashboard Colors
In `docs/index.html`, find the `:root` CSS block and change `--accent`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard shows "Failed to load data" | Check the Sheet is published publicly (Step 3 above) |
| Actions workflow fails | Go to Actions tab, click the failed run, read the error log |
| Data is stale | Trigger a manual workflow run (see above) |
| GitHub Pages not loading | Wait 2–5 minutes after enabling; check Settings → Pages |

## Maintainer

**Luqman** — [@luqmankhailmi](https://github.com/luqmankhailmi)

Data is maintained via the Google Sheet. No code changes needed to update dashbboard content.
