# pylint: disable=wildcard-import
# pylint: disable=unused-wildcard-import
# pylint: disable=duplicate-code
"""Combine ESPN and Underdog rankings."""

import argparse

import pandas as pd
from settings import add_common_args, input_path, output_path, path_from_arg_or_env
from utils import *

ESPN_PLAYER_COLUMN = "PLAYER NAME"
ESPN_AUCTION_VALUE_COLUMN_ORIGINAL = "ppr auction"
ESPN_AUCTION_VALUE_COLUMN = "ESPN Value"
ESPN_RANKING_COLUMN = "PPR"

UNDERDOG_PLAYER_COLUMN = "Player"
UNDERDOG_RANKING_COLUMN = "Rank"
UNDERDOG_AUCTION_VALUE_COLUMN = "UD Value"

OUTPUT_POSITION_COLUMN = "Pos"


def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows."""

    merged_list[UNDERDOG_RANKING_COLUMN] = merged_list[UNDERDOG_RANKING_COLUMN].astype(
        "Int64"
    )
    merged_list[ESPN_RANKING_COLUMN] = merged_list[ESPN_RANKING_COLUMN].astype("Int64")

    merged_list = merged_list[
        [
            OUTPUT_POSITION_COLUMN,
            ESPN_RANKING_COLUMN,
            UNDERDOG_RANKING_COLUMN,
            UNDERDOG_PLAYER_COLUMN,
            "Team",
            ESPN_AUCTION_VALUE_COLUMN_ORIGINAL,
            UNDERDOG_AUCTION_VALUE_COLUMN,
            "PriceRank",
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
                subset=[UNDERDOG_RANKING_COLUMN],
            )
            .apply(
                lambda col: highlight_cell_values(
                    col,
                    df[ESPN_AUCTION_VALUE_COLUMN],
                    df[OUTPUT_POSITION_COLUMN],
                    get_text_color_auction,
                ),
                subset=[UNDERDOG_AUCTION_VALUE_COLUMN],
            )
            .set_properties(**{"text-align": "center"})
        )

        styled_df = styled_df.map(highlight_positions, subset=[OUTPUT_POSITION_COLUMN])
        styled_df = styled_df.format({UNDERDOG_AUCTION_VALUE_COLUMN: "${:,.0f}"}).format(
            {ESPN_AUCTION_VALUE_COLUMN: "${:,.0f}"}
        )
        styled_df.to_excel(output_excel, engine="openpyxl", index=False)
    except ImportError as exc:
        print(f"WARN: Excel styling dependency missing ({exc}); writing unstyled workbook.")
        df.to_excel(output_excel, engine="openpyxl", index=False)

    df[ESPN_AUCTION_VALUE_COLUMN] = df[ESPN_AUCTION_VALUE_COLUMN].apply(
        lambda x: f"${int(x):,}"
    )
    df[UNDERDOG_AUCTION_VALUE_COLUMN] = df[UNDERDOG_AUCTION_VALUE_COLUMN].apply(
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

    df[UNDERDOG_AUCTION_VALUE_COLUMN] = df[UNDERDOG_RANKING_COLUMN].map(lookup_map)
    df[UNDERDOG_AUCTION_VALUE_COLUMN] = df[UNDERDOG_AUCTION_VALUE_COLUMN].fillna(0)

    return df


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    add_common_args(parser)
    parser.add_argument("--espn-rankings", help="Path to ESPN rankings CSV.")
    parser.add_argument("--underdog-rankings", help="Path to Underdog rankings CSV.")
    parser.add_argument("--output-csv", help="Path to write merged CSV output.")
    parser.add_argument("--output-excel", help="Path to write formatted XLSX output.")
    return parser.parse_args()


def main():
    """Run the merge."""
    args = parse_args()
    espn_rankings = path_from_arg_or_env(
        args.espn_rankings,
        "ESPN_RANKINGS",
        input_path(args.season, "espn_rankings.csv"),
    )
    underdog_rankings = path_from_arg_or_env(
        args.underdog_rankings,
        "UNDERDOG_RANKINGS",
        input_path(args.season, "underdog_rankings.csv"),
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

    ud_dataframe = load_csv_to_memory(underdog_rankings).head(args.limit)
    espn_dataframe = load_csv_to_memory(espn_rankings).head(args.limit)
    espn_dataframe.columns.values[0] = ESPN_PLAYER_COLUMN

    espn_dataframe = remove_name_suffix(espn_dataframe, ESPN_PLAYER_COLUMN)
    ud_dataframe = remove_name_suffix(ud_dataframe, UNDERDOG_PLAYER_COLUMN)

    merged_df = pd.merge(
        ud_dataframe,
        espn_dataframe,
        left_on=ud_dataframe[UNDERDOG_PLAYER_COLUMN].str.lower(),
        right_on=espn_dataframe[ESPN_PLAYER_COLUMN].str.lower(),
        how="inner",
    )

    merged_df = add_columns(merged_df)
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
