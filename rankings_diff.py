# pylint: disable=line-too-long
"""Module combining rankings from different sources"""

import pandas as pd

FPROS_RANKINGS = 'csv_data/fpros_rankings.csv'
FPROS_PLAYER_COLUMN = 'PLAYER NAME'

UNDERDOG_RANKINGS = 'csv_data/hw_rankings.csv'
UNDERDOG_PLAYER_COLUMN = 'Player'

# Step 2: Load the CSV file into memory
def load_csv_to_memory(local_filename):
    """Read the CSV file into a pandas DataFrame"""

    df = pd.read_csv(local_filename)
    return df

def clean_for_matches(player_list, player_column):
    """Clean df so they match on a join"""
    player_list[player_column] = player_list[player_column].apply(
        lambda x: x.replace(" Jr.", "").replace(" Sr.", "").
                    replace(" II", "").replace(" III", "").rstrip())

    return player_list

def format_merged_list(merged_list):
    """Clean up for the formatted final list by removing undesired columns and rows"""

    # Cast Rank to be an integer
    merged_list['Rank'] = merged_list['Rank'].astype('Int64')
    merged_list['RK'] = merged_list['RK'].astype('Int64')
    # Merge team and bye week

    # Remove Kickers and Defense
    merged_list = merged_list.drop(
        merged_list[merged_list['POS'].str.startswith('DST',na=False)].index)

    merged_list = merged_list.drop(
        merged_list[merged_list['POS'].str.startswith('K',na=False)].index)

    # Only keep desired columns
    merged_list = merged_list[['POS', 'RK', 'Rank', 'Player', 'Team (Bye)']].sort_values(by='RK')

    # Renaming columns
    merged_list = merged_list.rename(columns={'BYE WEEK': 'Bye', 'TEAM': 'Team', 'POS': 'Pos'})
    return merged_list

def get_text_color(a, b, pos):
    """Determine red green or black color"""
    if pd.isna(a) or pd.isna(b):
        return 'color: black'
    if (b-a)/b > 0.20 and b < 200 and b-a > 12:
        return 'background-color: lightgreen'
    if (b-a)/b < -0.15 and 10 < b < 200 and b-a < -12 and not str(pos).startswith('QB'):
        return 'background-color: coral'
    if (b-a)/b > 0.15 and a < 200:
        return 'color: green'
    if (b-a)/b < -0.15 and b > 10:
        return 'color: red'
    return 'color: black'

def highlight_cell_values(col, comp_val, pos, function):
    """Highlight certain cells based on their value"""
    return [function(x, y, z) for x, y, z in zip(col, comp_val, pos)]

def highlight_positions(val):
    """Define the styling function based on a players position"""
    if str(val).startswith('WR'):
        return 'background-color: lightcyan'
    if str(val).startswith('RB'):
        return 'background-color: #FFDAB9'
    if str(val).startswith('TE'):
        return 'background-color: lavender'
    if str(val).startswith('QB'):
        return 'background-color: lightyellow'
    return 'white'

def create_output_files(df):
    """Create a CSV and a formatted excell file in the data directory"""
    df.to_csv('csv_data/merged.csv', index=False)

    styled_df = df.style.apply(lambda col: highlight_cell_values(
        col, df['RK'], df['Pos'], get_text_color), subset=['Rank']).set_properties(**{'text-align': 'center'})

    styled_df = styled_df.map(highlight_positions, subset=['Pos'])

    styled_df.to_excel('csv_data/merged_formatted.xlsx', engine='openpyxl', index=False)

def add_columns(df):
    """Add columns to view the difference of certain columns"""
    df['Diff'] = df.eval('RK - Rank')
    df['Team (Bye)'] = df['TEAM'] + ' (' + df['BYE WEEK'] + ')'

    return df


# Execute the functions
ud_dataframe = load_csv_to_memory(UNDERDOG_RANKINGS).head(400)
fpros_dataframe = load_csv_to_memory(FPROS_RANKINGS).head(400)

fpros_dataframe = clean_for_matches(fpros_dataframe, FPROS_PLAYER_COLUMN)
ud_dataframe =  clean_for_matches(ud_dataframe, UNDERDOG_PLAYER_COLUMN)


# Display the first few rows of the DataFrame
merged_df = pd.merge(ud_dataframe, fpros_dataframe,
                        left_on=ud_dataframe[UNDERDOG_PLAYER_COLUMN].str.lower(),
                        right_on=fpros_dataframe[FPROS_PLAYER_COLUMN].str.lower(), how='inner')

merged_df = add_columns(merged_df)
merged_df = format_merged_list(merged_df)

create_output_files(merged_df)
print("Reached the end successfully.. I think")
