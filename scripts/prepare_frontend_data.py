"""Prepare static frontend data from generated RankingsDiff outputs."""

from __future__ import annotations

import csv
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "data" / "output"
ASSET_ROOT = ROOT / "data" / "assets"
STATUS_ROOT = ROOT / "data" / "status"
PUBLIC_DATA = ROOT / "frontend" / "public" / "data"
ESPN_GOOGLE_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "149NUwr9QRggJrdtuk2KG_eo-jXSOjEU1XCfUSHcBINw/edit?usp=sharing"
)

SOURCE_LABELS = {
    "fpros": "Fantasy Pros",
    "espn": "ESPN",
    "yahoo-half": "Yahoo Half PPR",
    "yahoo-full": "Yahoo Full PPR",
}

CSV_NAMES = {
    "fpros": "fpros_merged.csv",
    "espn": "merged.csv",
}

XLSX_NAMES = {
    "fpros": "fpros_merged_formatted.xlsx",
    "espn": "merged_formatted.xlsx",
}

def source_links(source: str, season: int) -> list[dict[str, str]]:
    """Return public pages that correspond to the source rankings for a sheet."""
    hayden_2026 = {
        "label": "Yahoo · Winks Half-PPR rankings",
        "url": (
            "https://sports.yahoo.com/fantasy/article/"
            "2026-fantasy-football-rankings-hayden-winks-top-300-overall-"
            "players-for-half-ppr-143555896.html"
        ),
    }
    if source == "fpros":
        links = [
            {
                "label": "FantasyPros PPR rankings",
                "url": "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
            }
        ]
        if season == 2026:
            links.append(hayden_2026)
            links.append({"label": "Yahoo · Consensus Full-PPR rankings", "url": "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-full-ppr-rankings-consensus-top-300-players-175205585.html"})
        return links
    if source == "espn":
        espn_url = (
            "https://www.espn.com/fantasy/football/story/_/id/47513496/"
            "2026-fantasy-football-rankings-ppr-mike-clay"
            if season == 2026
            else "https://www.espn.com/fantasy/football/story/_/page/"
            "FFCheatSheetCent25-44507555/"
            "2025-fantasy-football-rankings-cheat-sheet-depth-charts-ppr"
        )
        links = [
            {
                "label": f"ESPN {season} PPR300 PDF",
                "url": (
                    "https://g.espncdn.com/s/ffldraftkit/26/"
                    "NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300"
                ) if season == 2026 else espn_url,
            },
            {
                "label": "ESPN salary-cap Google Sheet fallback",
                "url": ESPN_GOOGLE_SHEET_URL,
            },
            {
                "label": "ESPN Fantasy / salary cap tools",
                "url": "https://www.espn.com/fantasy/football/",
            },
        ]
        if season == 2026:
            links.append(hayden_2026)
            links.append({"label": "Yahoo · Consensus Full-PPR rankings", "url": "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-full-ppr-rankings-consensus-top-300-players-175205585.html"})
        return links
    if source in {"yahoo-half", "yahoo-full"}:
        if source == "yahoo-full":
            return [
                {
                    "label": "Yahoo · Consensus Full-PPR rankings",
                    "url": "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-full-ppr-rankings-consensus-top-300-players-175205585.html",
                },
                {"label": "Yahoo player-rank documentation", "url": "https://help.yahoo.com/kb/SLN6287.html"},
            ]
        return [
            {
                "label": "Yahoo public draft rankings feed",
                "url": "https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/league/470.l.public/players;position=ALL;start=0;count=300;sort=rank_season",
            },
            {"label": "Yahoo player-rank documentation", "url": "https://help.yahoo.com/kb/SLN6287.html"},
        ]
    return []


TEAM_ALIASES = {
    "JAC": "JAX",
    "LA": "LAR",
    "WAS": "WSH",
}


def canonical_player_key(player: str | None, team: str | None = None) -> str:
    """Build a stable player/team key across source naming conventions."""
    name = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", (player or "").lower())
    name = re.sub(r"[^a-z0-9]", "", name)
    normalized_team = TEAM_ALIASES.get((team or "").strip().upper(), (team or "").strip().upper())
    return f"{name}|{normalized_team}"


def parse_number(value: Any) -> int | float | None:
    """Parse spreadsheet-ish numbers such as '$57' into numeric values."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return None
    text = text.replace("$", "").replace(",", "")
    try:
        parsed = float(text)
    except ValueError:
        return None
    return int(parsed) if parsed.is_integer() else parsed


def normalize_team(value: str | None) -> str:
    """Extract and normalize an NFL team abbreviation from source columns."""
    text = (value or "").strip().upper()
    match = re.search(r"[A-Z]{2,3}", text)
    team = match.group(0) if match else text
    return TEAM_ALIASES.get(team, team)


def position_tone(position: str | None) -> str:
    """Map positions to CSS-safe tone names."""
    value = (position or "").strip().upper()
    return value.lower() if value in {"QB", "RB", "WR", "TE"} else "other"


def diff_tone(diff: int | float | None) -> str:
    """Classify ranking/value differences for UI highlighting."""
    if diff is None:
        return "neutral"
    if diff >= 20:
        return "very-good"
    if diff >= 8:
        return "good"
    if diff <= -20:
        return "very-bad"
    if diff <= -8:
        return "bad"
    return "neutral"


def normalize_fpros(row: dict[str, str]) -> dict[str, Any]:
    """Normalize FantasyPros output rows."""
    source_rank = parse_number(row.get("RK"))
    adjusted_rank = parse_number(row.get("Rank"))
    diff = parse_number(row.get("Diff"))
    if diff is None and source_rank is not None and adjusted_rank is not None:
        diff = source_rank - adjusted_rank
    position = row.get("Position Category") or row.get("Position") or ""
    return {
        "player": row.get("Player", ""),
        "team": normalize_team(row.get("Team (Bye)") or row.get("Team")),
        "position": position,
        "positionRank": row.get("Pos") or None,
        "sourceRank": source_rank,
        "adjustedRank": adjusted_rank,
        "adjustedRankHalfPpr": parse_number(row.get("Adjusted Rank Half PPR")),
        "diff": diff,
        "diffTone": diff_tone(diff),
        "positionTone": position_tone(position),
    }


def normalize_espn(row: dict[str, str]) -> dict[str, Any]:
    """Normalize ESPN output rows."""
    source_rank = parse_number(row.get("PPR"))
    adjusted_rank = parse_number(row.get("Rank"))
    source_value = parse_number(row.get("ESPN Value"))
    adjusted_value = parse_number(row.get("Adjusted Value"))
    value_diff = None
    if source_value is not None and adjusted_value is not None:
        value_diff = adjusted_value - source_value
    position = row.get("Position") or row.get("Pos") or ""
    return {
        "player": row.get("Player", ""),
        "team": normalize_team(row.get("Team")),
        "position": position,
        "positionRank": row.get("Pos") or position or None,
        "sourceRank": source_rank,
        "adjustedRank": adjusted_rank,
        "adjustedRankHalfPpr": parse_number(row.get("Adjusted Rank Half PPR")),
        "sourceValue": source_value,
        "adjustedValue": adjusted_value,
        "priceRank": parse_number(row.get("PriceRank")),
        "diff": value_diff,
        "diffTone": diff_tone(value_diff),
        "positionTone": position_tone(position),
    }


def read_csv(path: Path) -> list[dict[str, str]]:
    """Read CSV rows using utf-8-sig for spreadsheet compatibility."""
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def normalize_yahoo(rows: list[dict[str, str]], season: int) -> list[dict[str, Any]]:
    """Normalize a Yahoo base sheet and attach both Winks adjustment profiles."""
    full_path = ROOT / "data" / "raw" / str(season) / "adjusted_full_ppr.csv"
    half_path = ROOT / "data" / "raw" / str(season) / "adjusted_half_ppr.csv"

    def adjustment_maps(path: Path) -> tuple[dict[str, int], dict[str, int]]:
        if not path.exists():
            return {}, {}
        by_team: dict[str, int] = {}
        by_name: dict[str, list[int]] = {}
        for row in read_csv(path):
            rank = parse_number(row.get("Rank"))
            if rank is None:
                continue
            by_team[canonical_player_key(row.get("Player"), row.get("Team"))] = int(rank)
            by_name.setdefault(canonical_player_key(row.get("Player")), []).append(int(rank))
        unique_names = {name: ranks[0] for name, ranks in by_name.items() if len(set(ranks)) == 1}
        return by_team, unique_names

    full_ranks, full_name_ranks = adjustment_maps(full_path)
    half_ranks, half_name_ranks = adjustment_maps(half_path)
    normalized = []
    for row in rows:
        source_rank = parse_number(row.get("Yahoo Rank"))
        team_key = canonical_player_key(row.get("Player"), row.get("Team"))
        name_key = canonical_player_key(row.get("Player"))
        adjusted_rank = full_ranks.get(team_key, full_name_ranks.get(name_key))
        adjusted_half = half_ranks.get(team_key, half_name_ranks.get(name_key))
        diff = source_rank - adjusted_rank if source_rank is not None and adjusted_rank is not None else None
        normalized.append({
            "player": row.get("Player", ""),
            "team": normalize_team(row.get("Team")),
            "position": row.get("Position", ""),
            "positionRank": None,
            "sourceRank": source_rank,
            "adjustedRank": adjusted_rank,
            "adjustedRankHalfPpr": adjusted_half,
            "diff": diff,
            "diffTone": diff_tone(diff),
            "positionTone": position_tone(row.get("Position")),
        })
    return normalized


def yahoo_payload_rows(path: Path) -> list[dict[str, str]]:
    """Convert Yahoo's public ranking payload into the base-sheet shape."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [
        {
            "Player": row.get("player_name", ""),
            "Team": row.get("player_team_id", ""),
            "Position": row.get("player_position_id", ""),
            "Yahoo Rank": str(row.get("rank_ecr", "")),
        }
        for row in payload.get("players", [])
        if row.get("rank_ecr") is not None
    ]


def yahoo_source_metadata(path: Path, season: int = 2026) -> dict[str, str | None]:
    """Expose freshness from the Yahoo payload without inventing a refresh time."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    updated = payload.get("last_updated")
    if updated and re.fullmatch(r"\d{1,2}/\d{1,2}", str(updated)):
        month, day = str(updated).split("/")
        updated = f"{season:04d}/{int(month):02d}/{int(day):02d}"
    observed = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat().replace("+00:00", "Z")
    return {"sourceUpdated": updated, "observedAt": observed}


def normalize_rows(source: str, csv_path: Path, season: int) -> list[dict[str, Any]]:
    """Normalize rows for a supported source."""
    if source == "yahoo-half":
        return normalize_yahoo(read_csv(csv_path), season)
    normalizer = normalize_espn if source == "espn" else normalize_fpros
    return [normalizer(row) for row in read_csv(csv_path)]


def public_path(path: Path) -> str:
    """Return a root-relative URL for frontend public assets."""
    return "/data/" + str(path.relative_to(PUBLIC_DATA)).replace("\\", "/")


def copy_status_files() -> None:
    """Expose generated status files to the frontend if present."""
    source = STATUS_ROOT / "source_checks.json"
    target = PUBLIC_DATA / "status" / "source_checks.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.exists():
        shutil.copy2(source, target)
    elif not target.exists():
        target.write_text('{"generatedAt":"","checks":[]}\n', encoding="utf-8")


def copy_team_assets() -> None:
    """Expose cached team assets to the frontend if present."""
    source = ASSET_ROOT / "espn_nfl_teams.json"
    target = PUBLIC_DATA / "assets" / "espn_nfl_teams.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.exists():
        shutil.copy2(source, target)
    elif not target.exists():
        target.write_text("{}\n", encoding="utf-8")


def build_manifest() -> dict[str, Any]:
    # pylint: disable=too-many-locals
    """Create manifest and per-source JSON data files."""
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    seasons = []
    for season_dir in sorted((p for p in OUTPUT_ROOT.iterdir() if p.is_dir()), reverse=True):
        try:
            season = int(season_dir.name)
        except ValueError:
            continue
        sources = []
        yahoo_projection_path = ROOT / "data" / "raw" / str(season) / "yahoo_projections.json"
        yahoo_projection_public_path = None
        if yahoo_projection_path.exists():
            yahoo_projection_target = PUBLIC_DATA / str(season) / "yahoo" / "projections.json"
            yahoo_projection_target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(yahoo_projection_path, yahoo_projection_target)
            yahoo_projection_public_path = public_path(yahoo_projection_target)
        for source_dir in sorted(p for p in season_dir.iterdir() if p.is_dir()):
            source = source_dir.name
            csv_name = CSV_NAMES.get(source, f"{source}_merged.csv")
            csv_path = source_dir / csv_name
            if not csv_path.exists():
                csv_files = sorted(source_dir.glob("*.csv"))
                if not csv_files:
                    continue
                csv_path = csv_files[0]
            rows = normalize_rows(source, csv_path, season)
            target_dir = PUBLIC_DATA / str(season) / source
            target_dir.mkdir(parents=True, exist_ok=True)
            rankings_path = target_dir / "rankings.json"
            rankings_path.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
            copied_csv = target_dir / csv_path.name
            shutil.copy2(csv_path, copied_csv)
            xlsx_path = source_dir / XLSX_NAMES.get(source, "merged_formatted.xlsx")
            xlsx_url = None
            if not xlsx_path.exists():
                xlsx_files = sorted(source_dir.glob("*.xlsx"))
                xlsx_path = xlsx_files[0] if xlsx_files else xlsx_path
            if xlsx_path.exists():
                copied_xlsx = target_dir / xlsx_path.name
                shutil.copy2(xlsx_path, copied_xlsx)
                xlsx_url = public_path(copied_xlsx)
            entry = {
                "id": source,
                "label": SOURCE_LABELS.get(source, f"{source.upper()} vs Adjusted"),
                "rowCount": len(rows),
                "json": public_path(rankings_path),
                "csv": public_path(copied_csv),
                "sourceLinks": source_links(source, season),
            }
            if source == "yahoo-half":
                yahoo_half_raw = ROOT / "data" / "raw" / str(season) / "yahoo_half-ppr_rankings.json"
                if yahoo_half_raw.exists():
                    entry.update(yahoo_source_metadata(yahoo_half_raw, season))
            if season == 2026:
                metadata_path = ROOT / "data" / "raw" / str(season) / "adjusted_rankings_metadata.json"
                if metadata_path.exists():
                    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                    half_url = "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-rankings-hayden-winks-top-300-overall-players-for-half-ppr-143555896.html"
                    full_url = "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-full-ppr-rankings-consensus-top-300-players-175205585.html"
                    entry["adjustedProfiles"] = [
                        {**metadata.get("sources", {}).get("full-ppr", {}), "id": "full-ppr", "label": "Full PPR · Winks", "shortLabel": "Full PPR", "sourceUrl": full_url, "observedAt": metadata.get("observedAt")},
                        {**metadata.get("sources", {}).get("half-ppr", {}), "id": "half-ppr", "label": "Half PPR · Winks", "shortLabel": "Half PPR", "sourceUrl": half_url, "observedAt": metadata.get("observedAt")},
                    ]
            if xlsx_url:
                entry["xlsx"] = xlsx_url
            sources.append(entry)
        # Yahoo publishes a separate full-PPR consensus feed alongside the
        # league-default feed. Keep it distinct from Winks' adjusted profile.
        if season == 2026:
            yahoo_full_path = ROOT / "data" / "raw" / "2026" / "yahoo_full-ppr_rankings.json"
            if yahoo_full_path.exists() and not any(item["id"] == "yahoo-full" for item in sources):
                rows = normalize_yahoo(yahoo_payload_rows(yahoo_full_path), season)
                target_dir = PUBLIC_DATA / "2026" / "yahoo-full"
                target_dir.mkdir(parents=True, exist_ok=True)
                rankings_path = target_dir / "rankings.json"
                rankings_path.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
                csv_path = target_dir / "rankings.csv"
                with csv_path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=["Player", "Team", "Position", "Yahoo Rank"])
                    writer.writeheader()
                    writer.writerows(yahoo_payload_rows(yahoo_full_path))
                metadata = yahoo_source_metadata(yahoo_full_path, season)
                adjusted_metadata_path = ROOT / "data" / "raw" / "2026" / "adjusted_rankings_metadata.json"
                adjusted_profiles = []
                if adjusted_metadata_path.exists():
                    adjusted_metadata = json.loads(adjusted_metadata_path.read_text(encoding="utf-8"))
                    half_url = "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-rankings-hayden-winks-top-300-overall-players-for-half-ppr-143555896.html"
                    full_url = "https://sports.yahoo.com/fantasy/article/2026-fantasy-football-full-ppr-rankings-consensus-top-300-players-175205585.html"
                    adjusted_profiles = [
                        {**adjusted_metadata.get("sources", {}).get("full-ppr", {}), "id": "full-ppr", "label": "Full PPR · Winks", "shortLabel": "Full PPR", "sourceUrl": full_url, "observedAt": adjusted_metadata.get("observedAt")},
                        {**adjusted_metadata.get("sources", {}).get("half-ppr", {}), "id": "half-ppr", "label": "Half PPR · Winks", "shortLabel": "Half PPR", "sourceUrl": half_url, "observedAt": adjusted_metadata.get("observedAt")},
                    ]
                sources.append({
                    "id": "yahoo-full",
                    "label": SOURCE_LABELS["yahoo-full"],
                    "rowCount": len(rows),
                    "json": public_path(rankings_path),
                    "csv": public_path(csv_path),
                    "sourceLinks": source_links("yahoo-full", season),
                    "adjustedProfiles": adjusted_profiles,
                    **metadata,
                })
        if sources:
            season_entry = {"season": season, "sources": sources}
            if yahoo_projection_public_path:
                season_entry["yahooProjections"] = yahoo_projection_public_path
            seasons.append(season_entry)
    # Generated outputs are intentionally ignored by git. Preserve committed
    # historical frontend seasons when a clean workflow checkout only rebuilds
    # the active season.
    manifest_path = PUBLIC_DATA / "manifest.json"
    if manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text(encoding="utf-8"))
            generated_seasons = {item["season"] for item in seasons}
            existing_by_season = {item["season"]: item for item in existing.get("seasons", [])}
            for season_entry in seasons:
                prior = existing_by_season.get(season_entry["season"], {})
                known_ids = {item["id"] for item in season_entry["sources"]}
                season_entry["sources"].extend(item for item in prior.get("sources", []) if item.get("id") not in known_ids)
            seasons.extend(
                item for item in existing.get("seasons", [])
                if item.get("season") not in generated_seasons
            )
            seasons.sort(key=lambda item: item["season"], reverse=True)
        except (json.JSONDecodeError, TypeError, KeyError):
            pass
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {"generatedAt": generated_at, "seasons": seasons}


def build_or_reuse_manifest() -> dict[str, Any]:
    """Keep committed static data when generated outputs are absent in a clean checkout."""
    manifest = build_manifest()
    if manifest["seasons"]:
        return manifest

    manifest_path = PUBLIC_DATA / "manifest.json"
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        if existing.get("seasons"):
            print("No generated outputs found; retaining committed frontend data.")
            return existing

    raise RuntimeError("No generated rankings or committed frontend manifest are available.")


def main() -> None:
    """Entrypoint."""
    manifest = build_or_reuse_manifest()
    copy_team_assets()
    copy_status_files()
    manifest_path = PUBLIC_DATA / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared frontend data: {manifest_path}")


if __name__ == "__main__":
    main()
