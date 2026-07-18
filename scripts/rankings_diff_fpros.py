# pylint: disable=wildcard-import
# pylint: disable=unused-wildcard-import
"""Module combining rankings from different sources"""

import os

import pandas as pd
from utils import *

FPROS_RANKINGS = os.getenv("FPROS_RANKINGS", "./data/raw/fpros_rankings_8_28.csv")
FPROS_PLAYER_COLUMN = "PLAYER NAME"
FPROS_RANK_COLUMN = "RK"

UNDERDOG_RANKINGS = os.getenv("UNDERDOG_RANKINGS", "./data/raw/underdog_rankings_8_24.csv")
UNDERDOG_PLAYER_COLUMN = "Player"
UNDERDOG_RANK_COLUMN = "Rank"

OUTPUT_EXCEL = os.getenv("OUTPUT_EXCEL", "./data/output/fpros/fpros_merged_formatted_25.xlsx")
OUTPUT_CSV = os.getenv("OUTPUT_CSV", "./data/output/fpros/fpros_merged_25.csv")

def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows"""

    # Cast Rank to be an integer
    merged_list[UNDERDOG_RANK_COLUMN] = merged_list[UNDERDOG_RANK_COLUMN].astype(
        "Int64"
    )
    merged_list[FPROS_RANK_COLUMN] = merged_list[FPROS_RANK_COLUMN].astype("Int64")
    merged_list = remove_kicker_defense(merged_list, "POS")

    # Append to Player based on Notes column (handle null/blank safely)
    notes = merged_list["Notes"]
    norm_notes = notes.where(notes.notna(), "").astype(str).str.strip()

    rookie_mask = norm_notes.str.casefold().eq("rookie")
    other_mask = norm_notes.ne("") & (~rookie_mask)

    merged_list.loc[rookie_mask, "Player"] = merged_list.loc[rookie_mask, "Player"] + " (R)"
    merged_list.loc[other_mask, "Player"] = merged_list.loc[other_mask, "Player"] + " (?)"

    # Drop the Notes column
    merged_list = merged_list.drop(columns=["Notes"])

    # Only keep desired columns
    merged_list = merged_list[
        ["POS", FPROS_RANK_COLUMN, UNDERDOG_RANK_COLUMN, "Player", "Team (Bye)", "Pos"]
    ].sort_values(by=FPROS_RANK_COLUMN)

    # Renaming columns
    merged_list = merged_list.rename(
        columns={
            "Pos": "Position Category",
            "POS": "Pos",
        }
    )
    return merged_list


def create_output_files(df):
    """Create a CSV and a formatted excell file in the data directory"""
    df.to_csv(OUTPUT_CSV, index=False)

    styled_df = df.style.apply(
        lambda col: highlight_cell_values(
            col, df[FPROS_RANK_COLUMN], df["Pos"], get_text_color
        ),
        subset=[UNDERDOG_RANK_COLUMN],
    ).set_properties(**{"text-align": "center"})

    styled_df = styled_df.map(highlight_positions, subset=["Pos"])

    styled_df.to_excel(OUTPUT_EXCEL, engine="openpyxl", index=False)


def add_columns(df):
    """Add columns to view the difference of certain columns"""
    df["Diff"] = df.eval(f"{FPROS_RANK_COLUMN}-{UNDERDOG_RANK_COLUMN}")
    df["Team (Bye)"] = df["TEAM"] + " (" + df["BYE"] + ")"

    return df


# Execute the functions
ud_dataframe = load_csv_to_memory(UNDERDOG_RANKINGS).head(400)
fpros_dataframe = load_csv_to_memory(FPROS_RANKINGS).head(400)

fpros_dataframe = remove_name_suffix(fpros_dataframe, FPROS_PLAYER_COLUMN)
ud_dataframe = remove_name_suffix(ud_dataframe, UNDERDOG_PLAYER_COLUMN)


# Merge the df's
merged_df = pd.merge(
    ud_dataframe,
    fpros_dataframe,
    left_on=ud_dataframe[UNDERDOG_PLAYER_COLUMN].str.lower(),
    right_on=fpros_dataframe[FPROS_PLAYER_COLUMN].str.lower(),
    how="inner",
)

merged_df = add_columns(merged_df)
merged_df = format_merged_list(merged_df)

print("WARN: Ensure you set export ESPN=false")
print("DEBUG: Top 10 rows of merged_df after add_columns:")
print(merged_df.head(10))

positional_bias = calculate_positional_bias(merged_df, position_col="Position Category",
espn_value_col="RK")

print("DEBUG: positional_bias after add_columns:")
print(positional_bias)

create_output_files(merged_df)
print("\033[92mMerged FPros successfully.. I think\033[0m")
