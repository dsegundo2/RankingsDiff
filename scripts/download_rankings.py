"""Download ranking inputs into the repo's season-based raw data folders.

Official/low-friction support:
- FantasyPros official API using FANTASYPROS_API_KEY.
- FantasyPros public rankings page as a no-key bootstrap fallback.
- ESPN public PPR300 cheat-sheet PDF as a no-key salary-cap source.
- ESPN public Google Sheet CSV export as a fallback.
- Underdog configurable CSV URLs because its draft/rankings exports are
  not exposed as stable unauthenticated APIs in this repo.
"""

# pylint: disable=too-many-locals

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from settings import add_common_args, input_path

FANTASYPROS_BASE_URL = "https://api.fantasypros.com/public/v2/json"
FANTASYPROS_PUBLIC_URL = "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php"
UNDERDOG_NETWORK_2026_URL = (
    "https://underdognetwork.com/football/fantasy-rankings/"
    "2026-fantasy-football-rankings"
)
FANTASYPROS_BOONE_PPR_URL = (
    "https://www.fantasypros.com/nfl/rankings/"
    "justin-boone-consensus-rankings.php?position=ALL&scoring=PPR&type=draft&year=2026"
)
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


def write_underdog_proxy_rows(season: int, players: list[dict[str, Any]]) -> None:
    """Bootstrap an Underdog-compatible CSV from FantasyPros ADP data."""
    adp_players = [player for player in players if player.get("adp") not in (None, "")]
    adp_players.sort(key=lambda player: float(player["adp"]))

    rows = []
    pos_counts: dict[str, int] = {}
    for rank, player in enumerate(adp_players, start=1):
        position = player["position"]
        pos_counts[position] = pos_counts.get(position, 0) + 1
        rows.append(
            {
                "Player": player["name"],
                "Rank": rank,
                "ADP": player["adp"],
                "Diff": "",
                f"Finish{season - 1}": "",
                "Team": player["team"],
                "Pos": position,
                "PosRank": pos_counts[position],
                "Notes": "",
                "Id": player.get("id", ""),
            }
        )

    output_path = input_path(season, "underdog_rankings.csv")
    write_csv(
        output_path,
        rows,
        [
            "Player",
            "Rank",
            "ADP",
            "Diff",
            f"Finish{season - 1}",
            "Team",
            "Pos",
            "PosRank",
            "Notes",
            "Id",
        ],
    )
    print(f"Wrote {output_path} from FantasyPros ADP as a bootstrap proxy")


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
    if args.write_underdog_adp_proxy:
        write_underdog_proxy_rows(args.season, players)


def clean_html_cell(cell: str) -> str:
    """Strip tags and normalize whitespace from an HTML table cell."""
    text = re.sub(r"<.*?>", " ", cell, flags=re.S)
    return re.sub(r"\s+", " ", text).strip()


def parse_player_team_position(value: str) -> tuple[str, str, str]:
    """Parse cells like 'Cam Skattebo NYG - RB'."""
    if " - " not in value:
        return value.strip(), "", ""
    left, position = value.rsplit(" - ", 1)
    bits = left.rsplit(" ", 1)
    if len(bits) == 1:
        return bits[0].strip(), "", position.strip()
    return bits[0].strip(), bits[1].strip(), position.strip()


def parse_boone_rows(page: str) -> list[dict[str, str]]:
    """Parse Justin Boone PPR rows from the FantasyPros comparison tables."""
    rows = []
    table_pattern = re.compile(r"<table[^>]*player-table[^>]*>(.*?)</table>", re.S)
    row_pattern = re.compile(r"<tr[^>]*>\s*(<td.*?</tr>)", re.S)
    cell_pattern = re.compile(r"<td[^>]*>(.*?)</td>", re.S)

    for table_html in table_pattern.findall(page):
        header = clean_html_cell(table_html[: table_html.find("</thead>")])
        boone_rank_first = "Justin Boone's Rank Player ECR" in header
        ecr_rank_first = "Expert Consensus's Rank Player Justin Boone's Rank" in header
        if not boone_rank_first and not ecr_rank_first:
            continue

        direction = "Boone higher than ECR" if boone_rank_first else "ECR higher than Boone"
        for row_html in row_pattern.findall(table_html):
            cells = [clean_html_cell(cell) for cell in cell_pattern.findall(row_html)]
            if len(cells) < 4 or not cells[0].isdigit() or not cells[2].isdigit():
                continue
            player, team, position = parse_player_team_position(cells[1])
            boone_rank = cells[0] if boone_rank_first else cells[2]
            ecr_rank = cells[2] if boone_rank_first else cells[0]
            rows.append(
                {
                    "Rank": boone_rank,
                    "Player": player,
                    "Team": team,
                    "Pos": position,
                    "ECR": ecr_rank,
                    "Diff": cells[3],
                    "Direction": direction,
                }
            )

    rows.sort(key=lambda row: int(row["Rank"]))
    return rows


def download_fantasypros_boone(args: argparse.Namespace) -> None:
    """Download Justin Boone's Yahoo PPR rankings exposed by FantasyPros."""
    if args.season != 2026 and not args.fantasypros_boone_url:
        raise SystemExit("Set --fantasypros-boone-url for Boone rankings outside 2026.")
    url = args.fantasypros_boone_url or FANTASYPROS_BOONE_PPR_URL
    page = fetch_bytes(url).decode("utf-8", "ignore")

    raw_path = input_path(args.season, "fantasypros_justin_boone_yahoo_ppr.html")
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(page, encoding="utf-8")

    rows = parse_boone_rows(page)
    if not rows:
        raise SystemExit("Could not find Justin Boone ranking rows on FantasyPros page.")

    output_path = input_path(args.season, "justin_boone_yahoo_ppr_rankings.csv")
    write_csv(
        output_path,
        rows,
        ["Rank", "Player", "Team", "Pos", "ECR", "Diff", "Direction"],
    )
    print(f"Wrote {output_path} from {url}")


def find_underdog_table(data: Any) -> list[dict[str, Any]]:
    """Find the Underdog rankings table inside Next.js page data."""
    if isinstance(data, list):
        if data and isinstance(data[0], dict) and {"Player", "Rank", "ADP"}.issubset(data[0]):
            return data
        for item in data:
            result = find_underdog_table(item)
            if result:
                return result
    elif isinstance(data, dict):
        for value in data.values():
            result = find_underdog_table(value)
            if result:
                return result
    return []


def download_underdog_network(args: argparse.Namespace) -> None:
    """Download Underdog Network article table rankings."""
    url = args.underdog_network_url or os.getenv("UNDERDOG_NETWORK_URL")
    if not url:
        if args.season != 2026:
            raise SystemExit(
                "Set UNDERDOG_NETWORK_URL or --underdog-network-url for this season."
            )
        url = UNDERDOG_NETWORK_2026_URL

    page = fetch_bytes(url).decode("utf-8", "ignore")
    raw_path = input_path(args.season, "underdog_network_rankings.html")
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(page, encoding="utf-8")

    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        page,
    )
    if not match:
        raise SystemExit("Could not find __NEXT_DATA__ on Underdog Network page.")

    table = find_underdog_table(json.loads(match.group(1)))
    if not table:
        raise SystemExit("Could not find Underdog rankings table data.")

    rows = []
    for player in table:
        rank = player.get("Rank")
        if rank in (None, ""):
            continue
        rows.append(
            {
                "Player": str(player.get("Player", "")).strip(),
                "Rank": rank,
                "ADP": player.get("ADP", ""),
                "Diff": "",
                f"Finish{args.season - 1}": player.get(f"Season {args.season - 1}", ""),
                "Team": player.get("Team", ""),
                "Pos": player.get("Pos", ""),
                "PosRank": player.get("PosRank", ""),
                "Notes": "",
                "Id": player.get("id", ""),
            }
        )

    output_path = input_path(args.season, "underdog_rankings.csv")
    write_csv(
        output_path,
        rows,
        [
            "Player",
            "Rank",
            "ADP",
            "Diff",
            f"Finish{args.season - 1}",
            "Team",
            "Pos",
            "PosRank",
            "Notes",
            "Id",
        ],
    )
    print(f"Wrote {output_path} from {url}")


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


def download_underdog(args: argparse.Namespace) -> None:
    """Download Underdog rankings from a caller-provided CSV URL."""
    url = args.underdog_url or os.getenv("UNDERDOG_RANKINGS_URL")
    if not url:
        raise SystemExit("Set UNDERDOG_RANKINGS_URL or pass --underdog-url.")

    headers = {}
    cookie = args.underdog_cookie or os.getenv("UNDERDOG_COOKIE")
    if cookie:
        headers["Cookie"] = cookie

    output_path = input_path(args.season, "underdog_rankings.csv")
    download_file(url, output_path, headers=headers)
    print(f"Wrote {output_path}")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    add_common_args(parser)
    parser.add_argument(
        "source",
        choices=[
            "fantasypros",
            "fantasypros-public",
            "fpros-boone",
            "espn",
            "underdog",
            "underdog-network",
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
    parser.add_argument("--fantasypros-boone-url", help="Justin Boone FantasyPros PPR URL.")
    parser.add_argument(
        "--write-underdog-adp-proxy",
        action="store_true",
        help="For fantasypros-public only: write an Underdog-compatible ADP proxy CSV.",
    )
    parser.add_argument("--espn-url", help="Direct ESPN CSV/export URL.")
    parser.add_argument("--espn-pdf-url", help="Direct ESPN PPR300 PDF URL.")
    parser.add_argument("--underdog-network-url", help="Underdog Network article URL.")
    parser.add_argument("--underdog-url", help="Direct Underdog CSV/export URL.")
    parser.add_argument(
        "--underdog-cookie",
        help="Cookie header for authenticated Underdog export URLs.",
    )
    return parser.parse_args()


def main() -> None:
    """Download selected ranking inputs."""
    args = parse_args()
    if args.source in {"fantasypros", "all"}:
        download_fantasypros(args)
    if args.source == "fantasypros-public":
        download_fantasypros_public(args)
    if args.source == "fpros-boone":
        download_fantasypros_boone(args)
    if args.source in {"espn", "all"}:
        download_espn(args)
    if args.source == "underdog-network":
        download_underdog_network(args)
    if args.source in {"underdog", "all"}:
        download_underdog(args)


if __name__ == "__main__":
    main()
