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

    # Remove Kickers and Defense
    merged_list = merged_list.drop(
        merged_list[merged_list['POS'].str.startswith('DST',na=False)].index)

    merged_list = merged_list.drop(
        merged_list[merged_list['POS'].str.startswith('K',na=False)].index)

    # Only keep desired columns
    merged_list = merged_list[
        ['RK', 'Rank', 'POS', 'Player', 'TEAM', 'Diff', 'ADP', 'BYE WEEK']].sort_values(by='RK')

    # Renaming columns
    merged_list = merged_list.rename(columns={'BYE WEEK': 'Bye', 'TEAM': 'Team'})
    return merged_list

def get_color(val, comp_value):
    """Determine red green or black color"""
    if pd.isna(val) or pd.isna(comp_value):
        return 'color: black'
    if (comp_value-val)/comp_value > 0.15 and comp_value < 200:
        return 'color: green'
    if (comp_value-val)/comp_value < -0.15 and comp_value > 10:
        return 'color: red'
    return 'color: black'

def highlight_cells(col, comp_val):
    """Highlight certain cells based on their value"""
    return [get_color(x, y) for x, y in zip(col, comp_val)]

def create_output_files(merged_list):
    """Create a CSV and a formatted excell file in the data directory"""
    merged_list.to_csv('csv_data/merged.csv', index=False)

    # merged_list = merged_list.style.map(highlight_cells, subset=['Rank'])
    merged_list = merged_list.style.apply(lambda col: highlight_cells(
        col, merged_list['RK']), subset=['Rank']).set_properties(**{'text-align': 'center'})

    merged_list.to_excel('csv_data/merged_formatted.xlsx', engine='openpyxl', index=False)

def add_columns(merged_dataframe):
    """Add columns to view the difference of certain columns"""
    merged_dataframe['Diff'] = merged_dataframe.eval('RK - Rank')

    return merged_dataframe


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
