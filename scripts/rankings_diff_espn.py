# pylint: disable=wildcard-import
# pylint: disable=unused-wildcard-import
# pylint: disable=duplicate-code
"""Combine ESPN and Adjusted rankings."""

import argparse

import pandas as pd
from settings import add_common_args, input_path, output_path, path_from_arg_or_env
from utils import *

ESPN_PLAYER_COLUMN = "PLAYER NAME"
ESPN_AUCTION_VALUE_COLUMN_ORIGINAL = "ppr auction"
ESPN_AUCTION_VALUE_COLUMN = "ESPN Value"
ESPN_RANKING_COLUMN = "PPR"
ESPN_HALF_PPR_RANKING_COLUMNS = ("Half PPR", "HALF PPR", "Half-PPR", "HALF-PPR")

ADJUSTED_PLAYER_COLUMN = "Player"
ADJUSTED_RANKING_COLUMN = "Rank"
HALF_ADJUSTED_RANKING_COLUMN = "Adjusted Rank Half PPR"
ADJUSTED_AUCTION_VALUE_COLUMN = "Adjusted Value"

OUTPUT_POSITION_COLUMN = "Pos"


def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows."""

    merged_list[ADJUSTED_RANKING_COLUMN] = merged_list[ADJUSTED_RANKING_COLUMN].astype(
        "Int64"
    )
    merged_list[ESPN_RANKING_COLUMN] = merged_list[ESPN_RANKING_COLUMN].astype("Int64")

    merged_list = merged_list[
        [
            OUTPUT_POSITION_COLUMN,
            ESPN_RANKING_COLUMN,
            ADJUSTED_RANKING_COLUMN,
            ADJUSTED_PLAYER_COLUMN,
            "Team",
            ESPN_AUCTION_VALUE_COLUMN_ORIGINAL,
            ADJUSTED_AUCTION_VALUE_COLUMN,
            "PriceRank",
            HALF_ADJUSTED_RANKING_COLUMN,
        ]
    ].sort_values(by=ESPN_RANKING_COLUMN)

    return merged_list.rename(
        columns={ESPN_AUCTION_VALUE_COLUMN_ORIGINAL: ESPN_AUCTION_VALUE_COLUMN}
    )


def create_output_files(df, output_csv, output_excel):
    """Create a CSV and a formatted Excel file in the data directory."""
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    output_excel.parent.mkdir(parents=True, exist_ok=True)

    try:
        styled_df = (
            df.style.apply(
                lambda col: highlight_cell_values(
                    col,
                    df[ESPN_RANKING_COLUMN],
                    df[OUTPUT_POSITION_COLUMN],
                    get_text_color,
                ),
                subset=[ADJUSTED_RANKING_COLUMN],
            )
            .apply(
                lambda col: highlight_cell_values(
                    col,
                    df[ESPN_AUCTION_VALUE_COLUMN],
                    df[OUTPUT_POSITION_COLUMN],
                    get_text_color_auction,
                ),
                subset=[ADJUSTED_AUCTION_VALUE_COLUMN],
            )
            .set_properties(**{"text-align": "center"})
        )

        styled_df = styled_df.map(highlight_positions, subset=[OUTPUT_POSITION_COLUMN])
        styled_df = styled_df.format({ADJUSTED_AUCTION_VALUE_COLUMN: "${:,.0f}"}).format(
            {ESPN_AUCTION_VALUE_COLUMN: "${:,.0f}"}
        )
        styled_df.to_excel(output_excel, engine="openpyxl", index=False)
    except ImportError as exc:
        print(f"WARN: Excel styling dependency missing ({exc}); writing unstyled workbook.")
        df.to_excel(output_excel, engine="openpyxl", index=False)

    df[ESPN_AUCTION_VALUE_COLUMN] = df[ESPN_AUCTION_VALUE_COLUMN].apply(
        lambda x: f"${int(x):,}"
    )
    df[ADJUSTED_AUCTION_VALUE_COLUMN] = df[ADJUSTED_AUCTION_VALUE_COLUMN].apply(
        lambda x: f"${int(x):,}"
    )
    df.to_csv(output_csv, index=False)


def add_columns(df):
    """Add columns to view the difference of certain columns."""

    df[ESPN_AUCTION_VALUE_COLUMN_ORIGINAL] = df[
        ESPN_AUCTION_VALUE_COLUMN_ORIGINAL
    ].astype("Int64")

    df = df.sort_values(
        ESPN_AUCTION_VALUE_COLUMN_ORIGINAL, ascending=False
    ).reset_index(drop=True)
    df["PriceRank"] = df.index + 1
    print(df.head())

    lookup_map = df.set_index("PriceRank")[ESPN_AUCTION_VALUE_COLUMN_ORIGINAL].to_dict()

    df[ADJUSTED_AUCTION_VALUE_COLUMN] = df[ADJUSTED_RANKING_COLUMN].map(lookup_map)
    df[ADJUSTED_AUCTION_VALUE_COLUMN] = df[ADJUSTED_AUCTION_VALUE_COLUMN].fillna(0)

    return df


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    add_common_args(parser)
    parser.add_argument("--espn-rankings", help="Path to ESPN rankings CSV.")
    parser.add_argument("--adjusted-rankings", help="Path to Adjusted rankings CSV.")
    parser.add_argument("--output-csv", help="Path to write merged CSV output.")
    parser.add_argument("--output-excel", help="Path to write formatted XLSX output.")
    parser.add_argument(
        "--espn-scoring",
        choices=["full-ppr", "half-ppr"],
        default="full-ppr",
        help="ESPN base ranking profile. Half PPR requires a CSV with a half-PPR rank column.",
    )
    return parser.parse_args()


def main():
    """Run the merge."""
    args = parse_args()
    default_espn_file = "espn_rankings.csv" if args.espn_scoring == "full-ppr" else "espn_half_ppr_rankings.csv"
    espn_rankings = path_from_arg_or_env(
        args.espn_rankings,
        "ESPN_RANKINGS_HALF_PPR" if args.espn_scoring == "half-ppr" else "ESPN_RANKINGS",
        input_path(args.season, default_espn_file),
    )
    adjusted_rankings = path_from_arg_or_env(
        args.adjusted_rankings,
        "ADJUSTED_RANKINGS",
        input_path(args.season, "adjusted_full_ppr.csv"),
    )
    output_csv = path_from_arg_or_env(
        args.output_csv,
        "OUTPUT_CSV",
        output_path(args.season, "espn", "merged.csv"),
    )
    output_excel = path_from_arg_or_env(
        args.output_excel,
        "OUTPUT_EXCEL",
        output_path(args.season, "espn", "merged_formatted.xlsx"),
    )

    adjusted_dataframe = load_csv_to_memory(adjusted_rankings).head(args.limit)
    half_adjusted_path = input_path(args.season, "adjusted_half_ppr.csv")
    half_adjusted_dataframe = load_csv_to_memory(half_adjusted_path).head(args.limit)
    espn_dataframe = load_csv_to_memory(espn_rankings).head(args.limit)
    espn_dataframe.columns.values[0] = ESPN_PLAYER_COLUMN

    if args.espn_scoring == "half-ppr":
        half_column = next((column for column in ESPN_HALF_PPR_RANKING_COLUMNS if column in espn_dataframe.columns), None)
        if half_column:
            espn_dataframe[ESPN_RANKING_COLUMN] = espn_dataframe[half_column]
        else:
            print("WARN: ESPN half-PPR rank column not found; using the supplied PPR rank as a proxy.")

    espn_dataframe = remove_name_suffix(espn_dataframe, ESPN_PLAYER_COLUMN)
    adjusted_dataframe = remove_name_suffix(adjusted_dataframe, ADJUSTED_PLAYER_COLUMN)
    half_adjusted_dataframe = remove_name_suffix(half_adjusted_dataframe, ADJUSTED_PLAYER_COLUMN)

    merged_df = pd.merge(
        adjusted_dataframe,
        espn_dataframe,
        left_on=adjusted_dataframe[ADJUSTED_PLAYER_COLUMN].str.lower(),
        right_on=espn_dataframe[ESPN_PLAYER_COLUMN].str.lower(),
        how="inner",
    )

    merged_df = add_columns(merged_df)
    half_lookup = dict(zip(half_adjusted_dataframe[ADJUSTED_PLAYER_COLUMN].str.lower(), half_adjusted_dataframe[ADJUSTED_RANKING_COLUMN]))
    merged_df[HALF_ADJUSTED_RANKING_COLUMN] = merged_df[ADJUSTED_PLAYER_COLUMN].str.lower().map(half_lookup)
    merged_df = format_merged_list(merged_df)

    print("DEBUG: Top 10 rows of merged_df after add_columns:")
    print(merged_df.head(10))

    average_position_bias = calculate_positional_bias(merged_df)

    print("DEBUG: positional_bias after add_columns:")
    print(average_position_bias)

    create_output_files(merged_df, output_csv, output_excel)
    print(f"\033[92mMerged ESPN successfully: {output_csv}\033[0m")


if __name__ == "__main__":
    main()
