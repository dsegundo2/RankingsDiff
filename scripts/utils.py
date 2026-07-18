# pylint: disable=too-many-arguments
"""Module with general util functions used across platform merges"""

import os

import pandas as pd

COLOR_VERY_GOOD = "background-color: lightgreen"
COLOR_GOOD = "color: green"
COLOR_NEUTRAL = "color: black"
COLOR_BAD = "color: red"
COLOR_VERY_BAD = "background-color: coral"

def load_csv_to_memory(local_filename):
    """Read the CSV file into a pandas DataFrame"""

    df = pd.read_csv(local_filename)
    return df


def remove_name_suffix(player_list, player_column):
    """Remove name suffix so they match on a join"""
    player_list[player_column] = player_list[player_column].apply(
        lambda x: x.replace(" Jr.", "")
        .replace(" Sr.", "")
        .replace(" II", "")
        .replace(" III", "")
        .rstrip()
    )

    return player_list


def get_text_color(a, b, pos):
    """Determine red green or black color for the rank"""
    a = safe_int_convert(a)
    b = safe_int_convert(b)
    diff = b - a
    perc_diff = diff / b + positional_bias(pos, b)
    if a == 0 or b == 0:
        return COLOR_NEUTRAL
    if perc_diff > 0.20 and b < 200 and diff > 10 or perc_diff > 0.50:
        return COLOR_VERY_GOOD
    if (
        perc_diff < -0.12
        and 10 < b < 150
        and diff < -12
    ):
        return COLOR_VERY_BAD
    if perc_diff > 0.15 and a < 200 and diff > 3:
        return COLOR_GOOD
    if perc_diff < -0.15 and b > 10 and diff < -3 or perc_diff < -0.60:
        return COLOR_BAD
    return COLOR_NEUTRAL

def positional_bias(pos, rank):
    """Accounts for different platforms being higher or lower on a position in general"""
    if (rank < 10 or rank > 160):
        return 0

    manual_switch_espn = os.getenv("ESPN", "TRUE").lower() in ("true", "1", "yes")
    pos = str(pos).upper()
    bias_map = {
        # (ESPN, FPROS)
        "QB": (0, 0.2),
        "WR": (-0.10, 0),
        "TE": (0.30, 0.2),
        "RB": (0.40, 0)
    }
    bias_tuple = bias_map.get(pos[:2], (0, 0))
    return bias_tuple[0] if manual_switch_espn else bias_tuple[1]

def get_text_color_auction(a, b, pos):
    """Determine red green or black color for the rank for auction so that low is better"""
    a = safe_int_convert(a)
    b = safe_int_convert(b)
    diff = b - a
    if a == 0 or b == 0:
        return COLOR_NEUTRAL
    if (diff / b) + positional_bias(pos, b) > 0.20 and a < 200 and diff > 10:
        return COLOR_VERY_BAD
    if (diff / b) + positional_bias(pos, b) < -0.12 and 2 < b and diff < -8:
        return COLOR_VERY_GOOD
    if (diff / b) + positional_bias(pos, b) > 0.12 and 1 < a and diff > 3:
        return COLOR_BAD
    if (diff / b) + positional_bias(pos, b) < -0.15 and b > 10 and diff < -3:
        return COLOR_GOOD
    return COLOR_NEUTRAL


def highlight_positions(val):
    """Define the styling function based on a player's position"""
    if str(val).startswith("WR"):
        return "background-color: lightcyan"
    if str(val).startswith("RB"):
        return "background-color: #FFDAB9"
    if str(val).startswith("TE"):
        return "background-color: lightsteelblue"
    if str(val).startswith("QB"):
        return "background-color: lightyellow"
    return "white"


def highlight_cell_values(col, comp_val, pos, function):
    """
    Highlight certain cells based on their value.
    Takes in two values and a function for how to compare them
    """
    return [function(x, y, z) for x, y, z in zip(col, comp_val, pos)]


def remove_kicker_defense(dataframe, position_column_name):
    """Remove Kickers and Defense from the list since missing from underdog"""
    result = dataframe.drop(
        dataframe[dataframe[position_column_name].str.startswith("DST", na=False)].index
    )

    result = result.drop(
        result[result[position_column_name].str.startswith("K", na=False)].index
    )

    return result


def safe_int_convert(value):
    """String to int with a default of 0"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


# Helper function only, not used directly
def calculate_positional_bias(
    combined_rankings,
    top_n=150,
    position_col="Pos",
    espn_value_col="PPR",
    ud_value_col="Rank",
):
    """
    Calculate the average (UD Value - ESPN Value) for each position within the top `top_n` rows
    ordered by the ESPN rank column (`PPR`). Returns a dict mapping position -> average diff.

    Parameters
    ----------
    combined_rankings : pandas.DataFrame
        DataFrame containing at least the columns [position_col, espn_value_col, ud_value_col].
    top_n : int, optional
        Number of top rows (by `rank_col`) to consider. Default is 200.
    position_col : str, optional
        Column name for player position. Default is "Pos".
    espn_value_col : str, optional
        Column name for ESPN auction/value. Default is "ESPN Value".
    ud_value_col : str, optional
        Column name for UD auction/value. Default is "UD Value".

    Returns
    -------
    dict
        Mapping of position (e.g., "RB", "WR", etc.) to average (UD - ESPN) value difference,
        rounded to 2 decimals. Returns an empty dict if required columns are missing.
    """
    if not isinstance(combined_rankings, pd.DataFrame):
        return {}

    df = combined_rankings.copy()

    # Restrict to the top N by the rank column when available
    if espn_value_col in df.columns:
        df = df.sort_values(by=espn_value_col, ascending=True).head(top_n)
    else:
        df = df.head(top_n)

    required = {position_col, espn_value_col, ud_value_col}
    if not required.issubset(df.columns):
        return {}

    # Coerce possible currency-formatted strings to numerics safely
    # df["_espn_val_num"] = safe_int_convert(df[espn_value_col])
    # df["_ud_val_num"] = safe_int_convert(df[ud_value_col])

    # Positive means UD market likes the position/player more than ESPN (on average)
    df["_diff_ud_minus_espn"] = df[espn_value_col] - df[ud_value_col]

    # Compute mean diff per position
    bias_series = df.groupby(position_col)["_diff_ud_minus_espn"].mean().round(2)

    return bias_series.to_dict()
