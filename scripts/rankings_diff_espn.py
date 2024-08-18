# pylint: disable=wildcard-import
# pylint: disable=unused-wildcard-import
"""Module combining rankings from espn and underdog"""

# import pandas as pd
from utils import *

ESPN_RANKINGS = "./data/raw/espn_rankings.csv"
ESPN_PLAYER_COLUMN = "PLAYER NAME"
ESPN_AUCTION_VALUE_COLUMN_ORIGINAL = "ppr auction"
ESPN_AUCTION_VALUE_COLUMN = "ESPN Value"
ESPN_RANKING_COLUMN = "index"

UNDERDOG_RANKINGS = "./data/raw/hw_rankings.csv"
UNDERDOG_PLAYER_COLUMN = "Player"
UNDERDOG_RANKING_COLUMN = "Rank"
UNDERDOG_AUCTION_VALUE_COLUMN = "UD Value"

OUTPUT_POSITION_COLUMN = "Pos"
OUTPUT_EXCEL = "./data/output/espn_merged_formatted.xlsx"
OUTPUT_CSV = "./data/output/espn_merged.csv"


def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows"""

    # Cast Rank to be an integer
    merged_list[UNDERDOG_RANKING_COLUMN] = merged_list[UNDERDOG_RANKING_COLUMN].astype(
        "Int64"
    )
    merged_list[ESPN_RANKING_COLUMN] = merged_list[ESPN_RANKING_COLUMN].astype("Int64")

    # Only keep desired columns
    merged_list = merged_list[
        [
            OUTPUT_POSITION_COLUMN,
            ESPN_RANKING_COLUMN,
            UNDERDOG_RANKING_COLUMN,
            UNDERDOG_PLAYER_COLUMN,
            "Team",
            ESPN_AUCTION_VALUE_COLUMN_ORIGINAL,
            UNDERDOG_AUCTION_VALUE_COLUMN,
        ]
    ].sort_values(by=ESPN_RANKING_COLUMN)
    # Renaming columns
    merged_list = merged_list.rename(columns={"ppr auction": ESPN_AUCTION_VALUE_COLUMN})

    return merged_list


def create_output_files(df):
    """Create a CSV and a formatted excell file in the data directory"""
    styled_df = (
        df.style.apply(
            lambda col: highlight_cell_values(
                col, df[ESPN_RANKING_COLUMN], df[OUTPUT_POSITION_COLUMN], get_text_color
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
    styled_df.to_excel(OUTPUT_EXCEL, engine="openpyxl", index=False)

    # Add dollar signs to auction values
    df[ESPN_AUCTION_VALUE_COLUMN] = df[ESPN_AUCTION_VALUE_COLUMN].apply(
        lambda x: f"${int(x):,}"
    )
    df[UNDERDOG_AUCTION_VALUE_COLUMN] = df[UNDERDOG_AUCTION_VALUE_COLUMN].apply(
        lambda x: f"${int(x):,}"
    )
    df.to_csv(OUTPUT_CSV, index=False)


def add_columns(df):
    """Add columns to view the difference of certain columns"""
    df["Diff"] = df.eval(f"{ESPN_RANKING_COLUMN}-{UNDERDOG_RANKING_COLUMN}")

    lookup_map = df.set_index(ESPN_RANKING_COLUMN)[
        ESPN_AUCTION_VALUE_COLUMN_ORIGINAL
    ].to_dict()
    df[UNDERDOG_AUCTION_VALUE_COLUMN] = df[UNDERDOG_RANKING_COLUMN].map(lookup_map)
    df[UNDERDOG_AUCTION_VALUE_COLUMN] = df[UNDERDOG_AUCTION_VALUE_COLUMN].fillna(0)

    return df


######## MAIN FUNCTION #############

# Load in csv data and clean player names for matching
ud_dataframe = load_csv_to_memory(UNDERDOG_RANKINGS).head(400)
espn_dataframe = load_csv_to_memory(ESPN_RANKINGS).head(400)
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

create_output_files(merged_df)
print("\033[92mMerged ESPN successfully.. I think\033[0m")
