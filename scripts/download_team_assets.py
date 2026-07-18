"""Download and cache ESPN NFL team asset metadata."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ASSET_PATH = ROOT / "data" / "assets" / "espn_nfl_teams.json"
PUBLIC_ASSET_PATH = ROOT / "frontend" / "public" / "data" / "assets" / "espn_nfl_teams.json"
ESPN_TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
ALIASES = {"JAC": "JAX", "LA": "LAR", "WAS": "WSH"}


def as_hex(value: str | None) -> str | None:
    """Normalize ESPN color strings to #RRGGBB."""
    if not value:
        return None
    clean = value.strip().lstrip("#")
    if len(clean) == 6:
        return f"#{clean.upper()}"
    return None


def choose_logo(logos: list[dict[str, Any]], prefer_dark: bool = False) -> str | None:
    """Pick a logo URL from ESPN logo variants."""
    if not logos:
        return None
    if prefer_dark:
        for logo in logos:
            href = logo.get("href")
            rel = {str(item).lower() for item in logo.get("rel", [])}
            if href and ({"dark", "full"} & rel):
                return href
    for logo in logos:
        href = logo.get("href")
        rel = {str(item).lower() for item in logo.get("rel", [])}
        if href and ("default" in rel or "full" in rel):
            return href
    return logos[0].get("href")


def fetch_payload() -> dict[str, Any]:
    """Fetch ESPN teams JSON."""
    request = urllib.request.Request(
        ESPN_TEAMS_URL, headers={"User-Agent": "RankingsDiff/1.0"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Normalize ESPN payload by team abbreviation."""
    records: dict[str, dict[str, Any]] = {}
    for sports_item in payload.get("sports", []):
        for league in sports_item.get("leagues", []):
            for team_item in league.get("teams", []):
                team = team_item.get("team", {})
                abbreviation = str(team.get("abbreviation", "")).upper()
                if not abbreviation:
                    continue
                logos = team.get("logos", [])
                records[abbreviation] = {
                    "id": str(team.get("id", "")),
                    "abbreviation": abbreviation,
                    "displayName": team.get("displayName") or team.get("name") or abbreviation,
                    "shortDisplayName": (
                        team.get("shortDisplayName") or team.get("name") or abbreviation
                    ),
                    "color": as_hex(team.get("color")),
                    "alternateColor": as_hex(team.get("alternateColor")),
                    "logo": choose_logo(logos),
                    "darkLogo": choose_logo(logos, prefer_dark=True),
                }
    for alias, canonical in ALIASES.items():
        if canonical in records:
            records[alias] = {**records[canonical], "abbreviation": alias}
    return dict(sorted(records.items()))


def write_assets(records: dict[str, dict[str, Any]]) -> None:
    """Write cached assets in data and frontend public dirs."""
    for path in (ASSET_PATH, PUBLIC_ASSET_PATH):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    """Entrypoint."""
    records = normalize(fetch_payload())
    write_assets(records)
    print(f"Wrote {len(records)} team records to {ASSET_PATH}")


if __name__ == "__main__":
    main()
