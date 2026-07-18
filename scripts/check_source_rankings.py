"""Generate source ranking checksum status for static frontend display.

The first version intentionally works without private API keys. It checks the
ranking artifacts already present in the repository, records their checksums,
and preserves the last-changed timestamp from the previous status file. This
makes it safe for local use and GitHub Actions. Future fetchers can add remote
snapshots before this checksum pass runs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = ROOT / "data" / "raw"
OUTPUT_ROOT = ROOT / "data" / "output"
STATUS_PATH = ROOT / "data" / "status" / "source_checks.json"
PUBLIC_STATUS_PATH = ROOT / "frontend" / "public" / "data" / "status" / "source_checks.json"
DEFAULT_MIN_INTERVAL_MINUTES = 10

SOURCE_LABELS = {
    "fpros": "FantasyPros",
    "espn": "ESPN",
    "underdog": "Underdog",
    "underdog-network": "Underdog Network",
    "boone-yahoo": "Justin Boone/Yahoo",
}

RAW_SOURCE_PATTERNS = {
    "fpros": ["fpros_rankings.csv", "fantasypros_public_rankings.html"],
    "espn": ["espn_rankings.csv", "espn_ppr300_cheatsheet.pdf"],
    "underdog": ["underdog_rankings.csv"],
    "underdog-network": ["underdog_network_rankings.html"],
    "boone-yahoo": [
        "justin_boone_yahoo_ppr_rankings.csv",
        "fantasypros_justin_boone_yahoo_ppr.html",
    ],
}

OUTPUT_SOURCE_FILES = {
    "fpros": ["fpros_merged.csv"],
    "espn": ["merged.csv"],
}


def utc_now() -> str:
    """Return a compact UTC ISO timestamp."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_timestamp(value: str | None) -> datetime | None:
    """Parse an ISO UTC timestamp from the status file."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def recently_checked(payload: dict[str, Any], min_interval_minutes: int) -> bool:
    """Return whether the existing status is inside the rate-limit window."""
    if min_interval_minutes <= 0:
        return False
    generated_at = parse_timestamp(payload.get("generatedAt"))
    if generated_at is None:
        return False
    return datetime.now(timezone.utc) - generated_at < timedelta(minutes=min_interval_minutes)


def file_sha256(path: Path) -> str:
    """Compute a SHA-256 checksum for a file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_previous(path: Path) -> dict[str, dict[str, Any]]:
    """Load previous status entries keyed by stable id."""
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {entry["id"]: entry for entry in payload.get("checks", []) if entry.get("id")}


def discover_raw_files() -> list[tuple[int, str, Path, str]]:
    """Find source-ish raw ranking files by season."""
    discovered = []
    for season_dir in sorted((path for path in RAW_ROOT.glob("*") if path.is_dir())):
        if not season_dir.name.isdigit():
            continue
        season = int(season_dir.name)
        for source, patterns in RAW_SOURCE_PATTERNS.items():
            for pattern in patterns:
                path = season_dir / pattern
                if path.exists():
                    discovered.append((season, source, path, "raw"))
    return discovered


def discover_output_files() -> list[tuple[int, str, Path, str]]:
    """Find generated ranking outputs by season/source convention."""
    discovered = []
    for season_dir in sorted((path for path in OUTPUT_ROOT.glob("*") if path.is_dir())):
        if not season_dir.name.isdigit():
            continue
        season = int(season_dir.name)
        for source_dir in sorted(path for path in season_dir.glob("*") if path.is_dir()):
            source = source_dir.name
            names = OUTPUT_SOURCE_FILES.get(source, [f"{source}_merged.csv", "merged.csv"])
            for name in names:
                path = source_dir / name
                if path.exists():
                    discovered.append((season, source, path, "output"))
    return discovered


# pylint: disable-next=too-many-arguments,too-many-positional-arguments
def build_check_entry(
    season: int,
    source: str,
    path: Path,
    kind: str,
    checked_at: str,
    previous: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Create one checksum status entry, preserving historical timestamps."""
    relative_path = path.relative_to(ROOT).as_posix()
    entry_id = f"{season}:{source}:{kind}:{relative_path}"
    current_checksum = file_sha256(path)
    previous_entry = previous.get(entry_id, {})
    previous_checksum = previous_entry.get("currentChecksum")

    if previous_checksum is None:
        status = "changed"
        last_changed_at = checked_at
    elif previous_checksum == current_checksum:
        status = "unchanged"
        last_changed_at = previous_entry.get("lastChangedAt") or checked_at
    else:
        status = "changed"
        last_changed_at = checked_at

    return {
        "id": entry_id,
        "season": season,
        "source": source,
        "sourceLabel": SOURCE_LABELS.get(source, source.replace("-", " ").title()),
        "kind": kind,
        "file": relative_path,
        "lastCheckedAt": checked_at,
        "lastChangedAt": last_changed_at,
        "previousChecksum": previous_checksum,
        "currentChecksum": current_checksum,
        "status": status,
    }


def write_status(payload: dict[str, Any], path: Path) -> None:
    """Write status JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build_status(include_outputs: bool = True) -> dict[str, Any]:
    """Build all source check status entries."""
    checked_at = utc_now()
    previous = read_previous(STATUS_PATH)
    candidates = discover_raw_files()
    if include_outputs:
        candidates.extend(discover_output_files())

    checks = [
        build_check_entry(season, source, path, kind, checked_at, previous)
        for season, source, path, kind in sorted(
            candidates, key=lambda item: (item[0], item[1], item[3], item[2].as_posix())
        )
    ]
    seen_ids = {entry["id"] for entry in checks}
    for previous_id, previous_entry in sorted(previous.items()):
        if previous_id in seen_ids:
            continue
        checks.append(
            {
                **previous_entry,
                "lastCheckedAt": checked_at,
                "previousChecksum": previous_entry.get("currentChecksum"),
                "currentChecksum": None,
                "status": "error",
                "message": "Previously tracked file is missing.",
            }
        )
    return {"generatedAt": checked_at, "checks": checks}


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw-only",
        action="store_true",
        help="Only check data/raw files, skipping generated data/output files.",
    )
    parser.add_argument(
        "--copy-to-public",
        action="store_true",
        help="Also write frontend/public/data/status/source_checks.json.",
    )
    parser.add_argument(
        "--min-interval-minutes",
        type=int,
        default=DEFAULT_MIN_INTERVAL_MINUTES,
        help="Skip a fresh check when the status file is newer than this many minutes.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Bypass the minimum interval rate limit.",
    )
    return parser.parse_args()


def main() -> None:
    """Entrypoint."""
    args = parse_args()
    existing_payload = None
    if STATUS_PATH.exists():
        existing_payload = json.loads(STATUS_PATH.read_text(encoding="utf-8"))
    if (
        existing_payload
        and not args.force
        and recently_checked(existing_payload, args.min_interval_minutes)
    ):
        if args.copy_to_public:
            write_status(existing_payload, PUBLIC_STATUS_PATH)
        print(
            "Skipped source ranking check: "
            f"last check was within {args.min_interval_minutes} minutes. "
            "Use --force to bypass."
        )
        return

    payload = build_status(include_outputs=not args.raw_only)
    write_status(payload, STATUS_PATH)
    if args.copy_to_public:
        write_status(payload, PUBLIC_STATUS_PATH)
    print(f"Checked {len(payload['checks'])} source ranking files: {STATUS_PATH}")


if __name__ == "__main__":
    main()
