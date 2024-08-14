"""Module with general util functions used across platform merges"""

import pandas as pd

COLOR_VERY_GOOD = 'background-color: lightgreen'
COLOR_GOOD = 'color: green'
COLOR_NEUTRAL = 'color: black'
COLOR_BAD = 'color: red'
COLOR_VERY_BAD = 'background-color: coral'

def load_csv_to_memory(local_filename):
    """Read the CSV file into a pandas DataFrame"""

    df = pd.read_csv(local_filename)
    return df

def remove_name_suffix(player_list, player_column):
    """Remove name suffix so they match on a join"""
    player_list[player_column] = player_list[player_column].apply(
        lambda x: x.replace(" Jr.", "").replace(" Sr.", "").
                    replace(" II", "").replace(" III", "").rstrip())

    return player_list

def get_text_color(a, b, pos):
    """Determine red green or black color for the rank"""
    a = safe_int_convert(a)
    b = safe_int_convert(b)
    if a == 0 or b == 0:
        return COLOR_NEUTRAL
    if (b-a)/b > 0.20 and b < 200 and b-a > 12:
        return COLOR_VERY_GOOD
    if (b-a)/b < -0.12 and 10 < b < 200 and b-a < -15 and not str(pos).startswith('QB'):
        return COLOR_VERY_BAD
    if (b-a)/b > 0.15 and a < 200 and b-a > 4:
        return COLOR_GOOD
    if (b-a)/b < -0.15 and b > 10 and b-a < -4:
        return COLOR_BAD
    return COLOR_NEUTRAL

def get_text_color_auction(a, b, _pos):
    """Determine red green or black color for the rank for auction so that low is better"""
    a = safe_int_convert(a)
    b = safe_int_convert(b)
    if a == 0 or b == 0:
        return COLOR_NEUTRAL
    if (b-a)/b > 0.20 and b < 200 and b-a > 12:
        return COLOR_VERY_BAD
    if (b-a)/b < -0.12 and 10 < b < 200 and b-a < -15:
        return COLOR_VERY_GOOD
    if (b-a)/b > 0.15 and a < 200 and b-a > 4:
        return COLOR_BAD
    if (b-a)/b < -0.15 and b > 10 and b-a < -4:
        return COLOR_GOOD
    return COLOR_NEUTRAL

def highlight_positions(val):
    """Define the styling function based on a player's position"""
    if str(val).startswith('WR'):
        return 'background-color: lightcyan'
    if str(val).startswith('RB'):
        return 'background-color: #FFDAB9'
    if str(val).startswith('TE'):
        return 'background-color: lavender'
    if str(val).startswith('QB'):
        return 'background-color: lightyellow'
    return 'white'

def highlight_cell_values(col, comp_val, pos, function):
    """
        Highlight certain cells based on their value. 
        Takes in two values and a function for how to compare them
    """
    return [function(x, y, z) for x, y, z in zip(col, comp_val, pos)]

def remove_kicker_defense(dataframe, position_column_name):
    """ Remove Kickers and Defense from the list since missing from underdog"""
    result = dataframe.drop(
    dataframe[dataframe[position_column_name].str.startswith('DST',na=False)].index)

    result = result.drop(
    result[result[position_column_name].str.startswith('K',na=False)].index)

    return result

def safe_int_convert(value):
    """String to int with a default of 0"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0
