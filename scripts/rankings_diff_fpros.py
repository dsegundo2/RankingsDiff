# pylint: disable=line-too-long
# pylint: disable=wildcard-import
# pylint: disable=unused-wildcard-import
"""Module combining rankings from different sources"""

import pandas as pd
from utils import *

FPROS_RANKINGS = './data/raw/fpros_rankings.csv'
FPROS_PLAYER_COLUMN = 'PLAYER NAME'
FPROS_RANK_COLUMN = 'RK'

UNDERDOG_RANKINGS = './data/raw/hw_rankings.csv'
UNDERDOG_PLAYER_COLUMN = 'Player'
UNDERDOG_RANK_COLUMN = 'Rank'

OUTPUT_EXCEL = './data/output/fpros_merged_formatted.xlsx'
OUTPUT_CSV = './data/output/fpros_merged.csv'

def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows"""

    # Cast Rank to be an integer
    merged_list[UNDERDOG_RANK_COLUMN] = merged_list[UNDERDOG_RANK_COLUMN].astype('Int64')
    merged_list[FPROS_RANK_COLUMN] = merged_list[FPROS_RANK_COLUMN].astype('Int64')
    # Merge team and bye week

    merged_list = remove_kicker_defense(merged_list, 'POS')

    # Only keep desired columns
    merged_list = merged_list[['POS', FPROS_RANK_COLUMN, UNDERDOG_RANK_COLUMN, 'Player', 'Team (Bye)']].sort_values(by=FPROS_RANK_COLUMN)

    # Renaming columns
    merged_list = merged_list.rename(columns={'BYE WEEK': 'Bye', 'TEAM': 'Team', 'POS': 'Pos'})
    return merged_list

def create_output_files(df):
    """Create a CSV and a formatted excell file in the data directory"""
    df.to_csv(OUTPUT_CSV, index=False)

    styled_df = df.style.apply(lambda col: highlight_cell_values(
        col, df[FPROS_RANK_COLUMN], df['Pos'], get_text_color), subset=[UNDERDOG_RANK_COLUMN]).set_properties(**{'text-align': 'center'})

    styled_df = styled_df.map(highlight_positions, subset=['Pos'])

    styled_df.to_excel(OUTPUT_EXCEL, engine='openpyxl', index=False)

def add_columns(df):
    """Add columns to view the difference of certain columns"""
    df['Diff'] = df.eval(f'{FPROS_RANK_COLUMN}-{UNDERDOG_RANK_COLUMN}')
    df['Team (Bye)'] = df['TEAM'] + ' (' + df['BYE WEEK'] + ')'

    return df

# Execute the functions
ud_dataframe = load_csv_to_memory(UNDERDOG_RANKINGS).head(400)
fpros_dataframe = load_csv_to_memory(FPROS_RANKINGS).head(400)

fpros_dataframe = remove_name_suffix(fpros_dataframe, FPROS_PLAYER_COLUMN)
ud_dataframe =  remove_name_suffix(ud_dataframe, UNDERDOG_PLAYER_COLUMN)


# Merge the df's
merged_df = pd.merge(ud_dataframe, fpros_dataframe,
                        left_on=ud_dataframe[UNDERDOG_PLAYER_COLUMN].str.lower(),
                        right_on=fpros_dataframe[FPROS_PLAYER_COLUMN].str.lower(), how='inner')

merged_df = add_columns(merged_df)
merged_df = format_merged_list(merged_df)

create_output_files(merged_df)
print("\033[92mMerged FPros successfully.. I think\033[0m")
