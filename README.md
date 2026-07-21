# Rankings Diff

Tools for comparing fantasy football rankings from Adjusted against FantasyPros or ESPN.

## Yearly workflow

The active season is controlled by `SEASON_YEAR` or `--season`. Inputs live under
`data/raw/<season>/`; generated outputs go to `data/output/<season>/<source>/`.
That means changing years should normally be just changing the year and replacing
that year's input files.

```bash
pip install -r requirements.txt

# FantasyPros vs Adjusted
python3 scripts/rankings_diff_fpros.py --season 2026

# ESPN vs Adjusted
python3 scripts/rankings_diff_espn.py --season 2026
```

You can override any path when testing one-off files:

```bash
python3 scripts/rankings_diff_fpros.py \
  --season 2026 \
  --fpros-rankings data/raw/2026/fpros_rankings.csv \
  --adjusted-rankings data/raw/2026/adjusted_rankings.csv
```

Expected default input names:

- `data/raw/<season>/fpros_rankings.csv`
- `data/raw/<season>/adjusted_rankings.csv`
- `data/raw/<season>/espn_rankings.csv`

Expected default outputs:

- `data/output/<season>/fpros/fpros_merged.csv`
- `data/output/<season>/fpros/fpros_merged_formatted.xlsx`
- `data/output/<season>/espn/merged.csv`
- `data/output/<season>/espn/merged_formatted.xlsx`

## Downloading inputs

`scripts/download_rankings.py` centralizes downloads where possible.

### FantasyPros

Preferred: FantasyPros offers an official API for consensus rankings. The repo intentionally requests `PPR` scoring for FantasyPros downloads. Set an API key and run:

```bash
FANTASYPROS_API_KEY=... python3 scripts/download_rankings.py fantasypros --season 2026
```

No-key bootstrap: the downloader can also parse the public FantasyPros PPR cheat-sheet page. This path is also locked to PPR:

```bash
python3 scripts/download_rankings.py fantasypros-public --season 2026 --write-adjusted-adp-proxy
```

That writes `fpros_rankings.csv` and, with the proxy flag, an adjusted CSV sorted by FantasyPros ADP.


### Justin Boone / Yahoo on FantasyPros

FantasyPros lists Justin Boone as Yahoo Sports expert ID `317`. The official API supports expert filters, but requires an API key for filtered expert data. Without an API key, the downloader can grab the publicly exposed Boone-vs-ECR PPR comparison table:

```bash
python3 scripts/download_rankings.py fpros-boone --season 2026
```

This writes `data/raw/2026/justin_boone_yahoo_ppr_rankings.csv`. Note that this public comparison page contains Boone ranks where FantasyPros shows a material difference vs. ECR; it is not a complete export of every Boone rank.

### ESPN

The ESPN input defaults to ESPN's official PPR300 cheat-sheet PDF, which includes PPR ranks and salary-cap dollar values:

```bash
python3 scripts/download_rankings.py espn --season 2026
```

Override the PDF or use a CSV export when needed:

```bash
ESPN_PPR300_PDF_URL='https://...' python3 scripts/download_rankings.py espn --season 2026
ESPN_RANKINGS_URL='https://...' python3 scripts/download_rankings.py espn --season 2026
```

The old third-party Google Sheet is still supported internally as a CSV fallback, but ESPN's PDF is the preferred source of truth.

### Hayden Winks adjusted rankings

The preferred fetch attempts the FantasyPros Hayden Winks expert page first. FantasyPros currently exposes the expert comparison page but not a complete all-player table, so the fetcher falls back to the Yahoo Sports article and its embedded ranking data:

```bash
python3 scripts/download_rankings.py hayden-winks --season 2026
```

This writes `data/raw/2026/adjusted_rankings.csv` and keeps the Yahoo HTML snapshot for repeatable parsing. Override either URL with `--fantasypros-hayden-url` or `--yahoo-hayden-url`.

### Adjusted

The adjusted sheet is a normalized local input. It can be fetched from any direct CSV/export URL when needed:

```bash
ADJUSTED_RANKINGS_URL='https://...' python3 scripts/download_rankings.py adjusted --season 2026
```

If the URL requires a logged-in session, pass a cookie header with `ADJUSTED_COOKIE` or `--adjusted-cookie`.

## Spreadsheet finishing touches

Recommended actions for CSV/Excel exports:

1. Fit cells to the size of the text.
2. Optional: alternate row coloring.
3. For auction, add/check currency formatting on the value columns.
4. Insert a checkbox column if marking picks on a computer.
5. If printing, mark round cutoffs.

## Data organization

Historical and duplicate files are archived under `data/archive/<season>/`. Keep active raw inputs in `data/raw/<season>/` and let scripts regenerate `data/output/<season>/`.

## Static frontend data and source checks

Regenerate the static frontend payloads after changing `data/output/<season>/<source>/`:

```bash
python3 scripts/check_source_rankings.py --copy-to-public
python3 scripts/prepare_frontend_data.py
```

`check_source_rankings.py` writes checksum status to `data/status/source_checks.json` and mirrors it to `frontend/public/data/status/source_checks.json` for the static UI. It records `lastCheckedAt`, `lastChangedAt`, previous/current checksums, source labels, season/source, and `changed`/`unchanged` status. The current implementation checks repository files only, so it does not need private API keys.

On GitHub Pages the frontend is static and cannot write back to the repository. Use the **Check source rankings** GitHub Actions workflow (`workflow_dispatch`) from the UI's “Run refresh workflow” link. If you explicitly set `commit_updates=true`, the workflow commits generated status/static data updates back to the branch; otherwise it only reports changes in the Actions log.

Logo explorations are available at `frontend/public/logo-options.html`.

### Triggering the rankings check GitHub Action

From GitHub:

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Check source rankings**.
4. Click **Run workflow**.
5. Leave `commit_updates` as `false` to only inspect changes in the run log, or set it to `true` to commit generated status/static data back to the branch.

The static frontend's **Switch sheet → Run refresh workflow** link opens that workflow page. The check script is rate-limited to one fresh checksum run every 10 minutes by default; use `--force` only for local/manual debugging when you intentionally want to bypass that guard.

## GitHub Pages and releases

GitHub Pages is deployed by `.github/workflows/pages.yml`. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**. No `/docs` directory or separate publishing branch is required: the workflow prepares the committed static data, builds `frontend/dist`, uploads that directory as the Pages artifact, and deploys it to:

`https://dsegundo2.github.io/RankingsDiff/`

The Vite production base path is already configured for `/RankingsDiff/`. Keep the repository name and that base path aligned if the repository is ever renamed.

Releases follow Semantic Versioning. The version in `frontend/package.json` is the release source of truth; pushing to `main` packages the frontend and creates `vMAJOR.MINOR.PATCH` if that tag does not already exist. Bump the package version before cutting a subsequent release.
