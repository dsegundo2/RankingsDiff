"""Download ranking inputs into the repo's season-based raw data folders.

Official/low-friction support:
- FantasyPros official API using FANTASYPROS_API_KEY.
- FantasyPros public rankings page as a no-key bootstrap.
- ESPN public PPR300 cheat-sheet PDF as a no-key salary-cap source.
- ESPN public Google Sheet CSV export as a fallback.
- Yahoo's Hayden Winks rankings article as the adjusted-ranking source.
"""

# pylint: disable=too-many-locals

from __future__ import annotations

import argparse
import csv
import html
import io
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

from settings import add_common_args, input_path

FANTASYPROS_BASE_URL = "https://api.fantasypros.com/public/v2/json"
FANTASYPROS_PUBLIC_URL = "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php"
YAHOO_HAYDEN_WINKS_2026_URL = (
    "https://sports.yahoo.com/fantasy/article/"
    "2026-fantasy-football-rankings-hayden-winks-top-300-overall-"
    "players-for-half-ppr-143555896.html"
)
FANTASYPROS_WIDGET_API_URL = "https://partners.fantasypros.com/api/v1/consensus-rankings.php"
FANTASYPROS_SCORING = "PPR"
ESPN_PPR300_PDF_URL = (
    "https://g.espncdn.com/s/ffldraftkit/26/"
    "NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300"
)
ESPN_GOOGLE_SHEET_ID = "149NUwr9QRggJrdtuk2KG_eo-jXSOjEU1XCfUSHcBINw"
ESPN_GOOGLE_SHEET_TAB = "JSONexport"
ESPN_GOOGLE_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    f"{ESPN_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet={ESPN_GOOGLE_SHEET_TAB}"
)
ESPN_GOOGLE_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    f"{ESPN_GOOGLE_SHEET_ID}/edit?usp=sharing"
)
USER_AGENT = "Mozilla/5.0 RankingsDiff/1.0"


def fetch_bytes(url: str, headers: dict[str, str] | None = None) -> bytes:
    """Fetch bytes from a URL using the standard library."""
    request_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    with urlopen(Request(url, headers=request_headers), timeout=60) as response:
        return response.read()


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    """Write dictionaries to CSV, creating directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def download_file(url: str, path: Path, headers: dict[str, str] | None = None) -> None:
    """Download a URL directly to a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(fetch_bytes(url, headers))


def normalize_espn_sheet_csv(raw_csv: bytes) -> str:
    """Add stable headers to the public ESPN Google Sheet JSONexport CSV."""
    rows = list(csv.reader(io.StringIO(raw_csv.decode("utf-8-sig"))))
    if len(rows) < 2:
        raise ValueError("ESPN Google Sheet export did not include ranking rows.")
    snapshot_label = rows[0][0] or "snapshot"
    header = [
        snapshot_label,
        "index",
        "PPR",
        "STD",
        "ADP",
        "Std auction",
        "ppr auction",
        "aav",
        "",
        "STD rank",
        "PPR rank",
    ]
    max_width = max(len(row) for row in rows)
    header.extend(f"extra_{index}" for index in range(len(header) + 1, max_width + 1))

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(header[:max_width])
    writer.writerows(rows[1:])
    return output.getvalue()


def download_espn_sheet(url: str, path: Path) -> None:
    """Download and normalize the public ESPN salary-cap Google Sheet CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(normalize_espn_sheet_csv(fetch_bytes(url)), encoding="utf-8")


def extract_pdf_text(pdf_path: Path) -> str:
    """Extract text from a PDF using pypdf."""
    try:
        from pypdf import PdfReader  # pylint: disable=import-outside-toplevel
    except ImportError as exc:
        raise SystemExit(
            "The ESPN PDF downloader requires pypdf. Run `pip install -r requirements.txt`."
        ) from exc

    reader = PdfReader(str(pdf_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def parse_espn_pdf_rows(pdf_path: Path) -> list[dict[str, Any]]:
    """Parse ESPN PPR300 cheat-sheet rows into the CSV shape used by the merger."""
    text = extract_pdf_text(pdf_path)
    pattern = re.compile(
        r"(\d+)\.\s+\(([A-Z]+\d+)\)\s+(.+?),\s+([A-Z]{2,3})\s+\$(\d+)\s+(\d+)"
    )
    rows_by_rank: dict[int, dict[str, Any]] = {}
    for match in pattern.finditer(text):
        rank = int(match.group(1))
        if rank in rows_by_rank:
            continue
        rows_by_rank[rank] = {
            "Player": match.group(3).strip(),
            "index": rank,
            "PPR": rank,
            "STD": rank,
            "ADP": "",
            "Std auction": int(match.group(5)),
            "ppr auction": int(match.group(5)),
            "aav": "",
        }

    missing = sorted(set(range(1, 301)) - set(rows_by_rank))
    if missing:
        raise ValueError(f"ESPN PDF parse missed ranks: {missing[:20]}")
    return [rows_by_rank[rank] for rank in sorted(rows_by_rank)]


def download_espn_pdf(url: str, csv_path: Path, pdf_path: Path) -> None:
    """Download the official ESPN cheat-sheet PDF and write normalized CSV rows."""
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_path.write_bytes(fetch_bytes(url))
    rows = parse_espn_pdf_rows(pdf_path)
    write_csv(
        csv_path,
        rows,
        [
            "Player",
            "index",
            "PPR",
            "STD",
            "ADP",
            "Std auction",
            "ppr auction",
            "aav",
        ],
    )


def get_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    """Fetch and parse JSON."""
    return json.loads(fetch_bytes(url, headers).decode("utf-8"))


def write_fantasypros_rows(season: int, rows: list[dict[str, Any]]) -> None:
    """Write normalized FantasyPros rows."""
    output_path = input_path(season, "fpros_rankings.csv")
    write_csv(
        output_path,
        rows,
        ["RK", "TIERS", "PLAYER NAME", "TEAM", "POS", "BYE", "SOS", "ECR VS ADP"],
    )
    print(f"Wrote {output_path}")


def download_fantasypros(args: argparse.Namespace) -> None:
    """Download FantasyPros consensus rankings from the official API."""
    api_key = args.fantasypros_api_key or os.getenv("FANTASYPROS_API_KEY")
    if not api_key:
        raise SystemExit("Set FANTASYPROS_API_KEY or pass --fantasypros-api-key.")

    query = urlencode(
        {"position": args.fantasypros_position, "scoring": FANTASYPROS_SCORING}
    )
    url = f"{FANTASYPROS_BASE_URL}/nfl/{args.season}/consensus-rankings?{query}"
    payload = get_json(url, {"x-api-key": api_key})

    raw_path = input_path(args.season, "fantasypros_consensus_rankings.json")
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    players = payload.get("players", [])
    rows = []
    for index, player in enumerate(players, start=1):
        rank = player.get("rank_ecr") or player.get("rank") or index
        team = player.get("player_team_id") or player.get("team") or ""
        position = player.get("player_position_id") or player.get("position") or ""
        position_rank = player.get("positional_rank") or f"{position}{index}"
        bye = player.get("bye_week") or player.get("bye") or ""
        rows.append(
            {
                "RK": rank,
                "TIERS": player.get("tier", ""),
                "PLAYER NAME": player.get("player_name") or player.get("name") or "",
                "TEAM": team,
                "POS": position_rank,
                "BYE": bye,
                "SOS": player.get("sos", ""),
                "ECR VS ADP": player.get("ecr_vs_adp", ""),
            }
        )

    write_fantasypros_rows(args.season, rows)


def extract_javascript_variable(page_html: str, variable_name: str) -> Any:
    """Extract a JSON-compatible JavaScript variable assignment from HTML."""
    marker = f"var {variable_name} ="
    start = page_html.find(marker)
    if start == -1:
        raise KeyError(f"Could not find {variable_name} in FantasyPros page.")
    raw_value = page_html[start + len(marker) :].lstrip()
    return json.JSONDecoder().raw_decode(raw_value)[0]


def parse_public_fantasypros_players(page_html: str) -> list[dict[str, Any]]:
    """Parse full FantasyPros ECR and ADP data embedded in the public page."""
    ecr_data = extract_javascript_variable(page_html, "ecrData")
    adp_data = extract_javascript_variable(page_html, "adpData")
    adp_by_player_id = {
        int(player["player_id"]): player.get("rank_ecr")
        for player in adp_data
        if player.get("player_id") and player.get("rank_ecr")
    }

    players = []
    for player in ecr_data.get("players", []):
        player_id = int(player["player_id"])
        rank = int(player["rank_ecr"])
        adp_rank = adp_by_player_id.get(player_id)
        ecr_vs_adp = "" if adp_rank is None else adp_rank - rank
        players.append(
            {
                "rank": rank,
                "name": player.get("player_name", ""),
                "id": player_id,
                "position": player.get("player_position_id", ""),
                "team": player.get("player_team_id", ""),
                "pos_rank": player.get("pos_rank", ""),
                "tier": player.get("tier", ""),
                "bye": player.get("player_bye_week", ""),
                "adp": adp_rank or "",
                "ecr_vs_adp": ecr_vs_adp,
            }
        )
    return players


def download_fantasypros_public(args: argparse.Namespace) -> None:
    """Bootstrap FantasyPros rankings from the public rankings page."""
    query = urlencode({"scoring": FANTASYPROS_SCORING})
    page = fetch_bytes(f"{FANTASYPROS_PUBLIC_URL}?{query}").decode("utf-8", "ignore")
    raw_path = input_path(args.season, "fantasypros_public_rankings.html")
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(page, encoding="utf-8")

    players = parse_public_fantasypros_players(page)
    pos_counts: dict[str, int] = {}
    rows = []
    for player in players:
        position = player["position"]
        pos_counts[position] = pos_counts.get(position, 0) + 1
        rows.append(
            {
                "RK": player["rank"],
                "TIERS": player.get("tier", ""),
                "PLAYER NAME": player["name"],
                "TEAM": player["team"],
                "POS": player.get("pos_rank") or f"{position}{pos_counts[position]}",
                "BYE": player.get("bye", ""),
                "SOS": "",
                "ECR VS ADP": player["ecr_vs_adp"],
            }
        )

    write_fantasypros_rows(args.season, rows)
def write_adjusted_rows(season: int, rows: list[dict[str, str]], url: str) -> None:
    """Write the normalized adjusted ranking shape consumed by both mergers."""
    pos_counts: dict[str, int] = {}
    output_rows = []
    for row in rows:
        position = row.get("Pos", "")
        pos_counts[position] = pos_counts.get(position, 0) + 1
        output_rows.append({
            "Player": row.get("Player", ""), "Rank": row.get("Rank", ""), "ADP": "",
            "Diff": "", f"Finish{season - 1}": "", "Team": row.get("Team", ""),
            "Pos": position, "PosRank": pos_counts[position], "Notes": "", "Id": row.get("Id", ""),
        })
    output_path = input_path(season, "adjusted_rankings.csv")
    write_csv(
        output_path,
        output_rows,
        [
            "Player", "Rank", "ADP", "Diff", f"Finish{season - 1}", "Team",
            "Pos", "PosRank", "Notes", "Id",
        ],
    )
    print(f"Wrote {output_path} from {url}")


def extract_yahoo_ranking_widget_url(page_html: str) -> str:
    """Extract Yahoo's embedded FantasyPros ranking widget URL.

    Yahoo renders the ranking table through a ``rankingPro`` story atom. The
    atom is serialized into the Next.js flight payload, so it is present in
    the downloaded HTML even though the table itself is client-rendered.
    """
    match = re.search(
        r"https://partners\.fantasypros\.com/external/widget/fp-widget\.php\?[^\"]+",
        page_html,
    )
    if not match:
        raise ValueError("Yahoo article does not contain a FantasyPros ranking widget URL.")

    widget_url = html.unescape(match.group(0))
    widget_url = re.sub(
        r"\\u([0-9a-fA-F]{4})",
        lambda item: chr(int(item.group(1), 16)),
        widget_url,
    )
    return widget_url


def fetch_yahoo_widget_rankings(widget_url: str) -> dict[str, Any]:
    """Fetch the structured JSONP payload behind Yahoo's ranking widget."""
    widget_params = parse_qs(urlsplit(widget_url).query)

    def first(name: str, default: str = "") -> str:
        return widget_params.get(name, [default])[0]

    query = {
        "callback": "rankingsDiffCallback",
        "position": first("half_positions", "ALL"),
        "sport": first("sport", "NFL"),
        "year": first("year"),
        "week": first("week", "0"),
        "experts": "show",
        "id": first("expert"),
        "type": "draft",
        "scoring": first("scoring", "HALF"),
        "filters": first("filters"),
        "widget": "ST",
    }
    endpoint = f"{FANTASYPROS_WIDGET_API_URL}?{urlencode(query)}"
    payload = fetch_bytes(endpoint).decode("utf-8", "ignore").strip()
    json_match = re.match(r"^[^(]+\((.*)\)\s*;?$", payload, re.DOTALL)
    if not json_match:
        raise ValueError("FantasyPros ranking widget returned invalid JSONP.")
    return json.loads(json_match.group(1))


def normalize_yahoo_widget_players(payload: dict[str, Any]) -> list[dict[str, str]]:
    """Convert the widget's player records to the adjusted CSV shape."""
    players = payload.get("players", [])
    rows = []
    for player in players:
        rank = player.get("rank_ecr") or player.get("rank")
        name = player.get("player_name")
        if rank is None or not name:
            continue
        rows.append(
            {
                "Player": str(name),
                "Rank": str(rank),
                "Team": str(player.get("player_team_id") or ""),
                "Pos": str(player.get("player_position_id") or ""),
                "Id": str(player.get("player_id") or ""),
            }
        )
    rows.sort(key=lambda row: int(row["Rank"]))
    return rows


def download_hayden_winks(args: argparse.Namespace) -> None:
    """Fetch Hayden Winks' Yahoo rankings through Yahoo's embedded widget.

    The article HTML contains the widget configuration, while the widget's
    documented-by-client JSONP request returns the complete 300-player table.
    This avoids scraping rendered table markup and avoids requiring an API key.
    """
    yahoo_url = args.yahoo_hayden_url or os.getenv("YAHOO_HAYDEN_WINKS_URL")
    if not yahoo_url:
        if args.season != 2026:
            raise SystemExit("Set YAHOO_HAYDEN_WINKS_URL or --yahoo-hayden-url for this season.")
        yahoo_url = YAHOO_HAYDEN_WINKS_2026_URL

    page = fetch_bytes(yahoo_url).decode("utf-8", "ignore")
    raw_path = input_path(args.season, "yahoo_hayden_winks_rankings.html")
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(page, encoding="utf-8")

    widget_url = extract_yahoo_ranking_widget_url(page)
    payload = fetch_yahoo_widget_rankings(widget_url)
    rows = normalize_yahoo_widget_players(payload)
    if len(rows) < 250:
        raise SystemExit(
            "Yahoo's embedded ranking widget returned only "
            f"{len(rows)} ranking rows; expected at least 250."
        )

    json_path = input_path(args.season, "yahoo_hayden_winks_rankings.json")
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_adjusted_rows(args.season, rows, yahoo_url)


def download_espn(args: argparse.Namespace) -> None:
    """Download ESPN salary-cap rankings from PDF, CSV URL, or sheet fallback."""
    csv_path = input_path(args.season, "espn_rankings.csv")
    pdf_url = args.espn_pdf_url or os.getenv("ESPN_PPR300_PDF_URL")
    csv_url = args.espn_url or os.getenv("ESPN_RANKINGS_URL")

    if pdf_url or not csv_url:
        url = pdf_url or ESPN_PPR300_PDF_URL
        pdf_path = input_path(args.season, "espn_ppr300_cheatsheet.pdf")
        download_espn_pdf(url, csv_path, pdf_path)
        print(f"Wrote {csv_path} from {url}")
        return

    if csv_url == ESPN_GOOGLE_SHEET_CSV_URL:
        download_espn_sheet(csv_url, csv_path)
    else:
        download_file(csv_url, csv_path)
    print(f"Wrote {csv_path} from {csv_url}")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    add_common_args(parser)
    parser.add_argument(
        "source",
        choices=[
            "fantasypros",
            "fantasypros-public",
            "espn",
            "hayden-winks",
            "all",
        ],
        help="Which input to download.",
    )
    parser.add_argument("--fantasypros-api-key", help="FantasyPros API key.")
    parser.add_argument("--fantasypros-position", default="ALL", help="FantasyPros position.")
    parser.add_argument(
        "--fantasypros-scoring",
        default=FANTASYPROS_SCORING,
        choices=[FANTASYPROS_SCORING],
        help="FantasyPros scoring is intentionally locked to PPR.",
    )
    parser.add_argument("--espn-url", help="Direct ESPN CSV/export URL.")
    parser.add_argument("--espn-pdf-url", help="Direct ESPN PPR300 PDF URL.")
    parser.add_argument(
        "--fantasypros-hayden-url", help="FantasyPros Hayden Winks expert rankings URL."
    )
    parser.add_argument("--yahoo-hayden-url", help="Yahoo Hayden Winks rankings article URL.")
    return parser.parse_args()


def main() -> None:
    """Download selected ranking inputs."""
    args = parse_args()
    if args.source in {"fantasypros", "all"}:
        download_fantasypros(args)
    if args.source == "fantasypros-public":
        download_fantasypros_public(args)
    if args.source in {"espn", "all"}:
        download_espn(args)
    if args.source == "hayden-winks":
        download_hayden_winks(args)


if __name__ == "__main__":
    main()
