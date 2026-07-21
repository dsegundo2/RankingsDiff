# pylint: disable=wildcard-import
# pylint: disable=unused-wildcard-import
# pylint: disable=duplicate-code
"""Combine FantasyPros and Adjusted rankings."""

import argparse

import pandas as pd
from settings import add_common_args, input_path, output_path, path_from_arg_or_env
from utils import *

FPROS_PLAYER_COLUMN = "PLAYER NAME"
FPROS_RANK_COLUMN = "RK"

ADJUSTED_PLAYER_COLUMN = "Player"
ADJUSTED_RANK_COLUMN = "Rank"


def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows."""

    merged_list[ADJUSTED_RANK_COLUMN] = merged_list[ADJUSTED_RANK_COLUMN].astype(
        "Int64"
    )
    merged_list[FPROS_RANK_COLUMN] = merged_list[FPROS_RANK_COLUMN].astype("Int64")
    merged_list = remove_kicker_defense(merged_list, "POS")

    notes = merged_list["Notes"]
    norm_notes = notes.where(notes.notna(), "").astype(str).str.strip()

    rookie_mask = norm_notes.str.casefold().eq("rookie")
    other_mask = norm_notes.ne("") & (~rookie_mask)

    merged_list.loc[rookie_mask, "Player"] = (
        merged_list.loc[rookie_mask, "Player"] + " (R)"
    )
    merged_list.loc[other_mask, "Player"] = (
        merged_list.loc[other_mask, "Player"] + " (?)"
    )

    merged_list = merged_list.drop(columns=["Notes"])

    merged_list = merged_list[
        ["POS", FPROS_RANK_COLUMN, ADJUSTED_RANK_COLUMN, "Player", "Team (Bye)", "Pos"]
    ].sort_values(by=FPROS_RANK_COLUMN)

    return merged_list.rename(
        columns={
            "Pos": "Position Category",
            "POS": "Pos",
        }
    )


def create_output_files(df, output_csv, output_excel):
    """Create a CSV and a formatted Excel file in the data directory."""
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    output_excel.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(output_csv, index=False)

    try:
        styled_df = df.style.apply(
            lambda col: highlight_cell_values(
                col, df[FPROS_RANK_COLUMN], df["Pos"], get_text_color
            ),
            subset=[ADJUSTED_RANK_COLUMN],
        ).set_properties(**{"text-align": "center"})

        styled_df = styled_df.map(highlight_positions, subset=["Pos"])
        styled_df.to_excel(output_excel, engine="openpyxl", index=False)
    except ImportError as exc:
        print(f"WARN: Excel styling dependency missing ({exc}); writing unstyled workbook.")
        df.to_excel(output_excel, engine="openpyxl", index=False)


def format_bye(value):
    """Format bye week values without pandas float artifacts."""
    if pd.isna(value) or value == "":
        return ""
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return str(value)


def add_columns(df):
    """Add columns to view the difference of certain columns."""
    df["Diff"] = df.eval(f"{FPROS_RANK_COLUMN}-{ADJUSTED_RANK_COLUMN}")
    bye_column = first_existing_column(df, ["BYE", "BYE WEEK"])
    bye_values = df[bye_column].map(format_bye)
    df["Team (Bye)"] = df["TEAM"] + " (" + bye_values + ")"

    return df


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    add_common_args(parser)
    parser.add_argument("--fpros-rankings", help="Path to FantasyPros rankings CSV.")
    parser.add_argument("--adjusted-rankings", help="Path to Adjusted rankings CSV.")
    parser.add_argument("--output-csv", help="Path to write merged CSV output.")
    parser.add_argument("--output-excel", help="Path to write formatted XLSX output.")
    return parser.parse_args()


def main():
    """Run the merge."""
    args = parse_args()
    fpros_rankings = path_from_arg_or_env(
        args.fpros_rankings,
        "FPROS_RANKINGS",
        input_path(args.season, "fpros_rankings.csv"),
    )
    adjusted_rankings = path_from_arg_or_env(
        args.adjusted_rankings,
        "ADJUSTED_RANKINGS",
        input_path(args.season, "adjusted_rankings.csv"),
    )
    output_csv = path_from_arg_or_env(
        args.output_csv,
        "OUTPUT_CSV",
        output_path(args.season, "fpros", "fpros_merged.csv"),
    )
    output_excel = path_from_arg_or_env(
        args.output_excel,
        "OUTPUT_EXCEL",
        output_path(args.season, "fpros", "fpros_merged_formatted.xlsx"),
    )

    adjusted_dataframe = load_csv_to_memory(adjusted_rankings).head(args.limit)
    fpros_dataframe = load_csv_to_memory(fpros_rankings).head(args.limit)

    fpros_dataframe = remove_name_suffix(fpros_dataframe, FPROS_PLAYER_COLUMN)
    adjusted_dataframe = remove_name_suffix(adjusted_dataframe, ADJUSTED_PLAYER_COLUMN)

    merged_df = pd.merge(
        adjusted_dataframe,
        fpros_dataframe,
        left_on=adjusted_dataframe[ADJUSTED_PLAYER_COLUMN].str.lower(),
        right_on=fpros_dataframe[FPROS_PLAYER_COLUMN].str.lower(),
        how="inner",
    )

    merged_df = add_columns(merged_df)
    merged_df = format_merged_list(merged_df)

    print("DEBUG: Top 10 rows of merged_df after add_columns:")
    print(merged_df.head(10))

    average_position_bias = calculate_positional_bias(
        merged_df, position_col="Position Category", espn_value_col="RK"
    )

    print("DEBUG: positional_bias after add_columns:")
    print(average_position_bias)

    create_output_files(merged_df, output_csv, output_excel)
    print(f"\033[92mMerged FantasyPros successfully: {output_csv}\033[0m")


if __name__ == "__main__":
    main()
