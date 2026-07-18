"""Shared path and configuration helpers for rankings scripts."""

from __future__ import annotations

import argparse
import os
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SEASON = datetime.now().year


def season_from_env() -> int:
    """Return the active fantasy season year."""
    return int(os.getenv("SEASON_YEAR", DEFAULT_SEASON))


def project_path(path: str | Path) -> Path:
    """Resolve a repo-relative path, leaving absolute paths untouched."""
    candidate = Path(path).expanduser()
    if candidate.is_absolute():
        return candidate
    return PROJECT_ROOT / candidate


def input_path(season: int, filename: str) -> Path:
    """Return the conventional raw input path for a season."""
    return PROJECT_ROOT / "data" / "raw" / str(season) / filename


def output_path(season: int, source: str, filename: str) -> Path:
    """Return the conventional generated output path for a season/source."""
    return PROJECT_ROOT / "data" / "output" / str(season) / source / filename


def add_common_args(parser: argparse.ArgumentParser) -> None:
    """Add options shared by the rankings scripts."""
    parser.add_argument(
        "--season",
        type=int,
        default=season_from_env(),
        help="Fantasy season year. Defaults to SEASON_YEAR or the current year.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("RANKINGS_LIMIT", "400")),
        help="Number of rows to read from each source before merging.",
    )


def path_from_arg_or_env(value: str | None, env_name: str, default: Path) -> Path:
    """Resolve a CLI value, environment variable, or default path."""
    return project_path(value or os.getenv(env_name) or default)
