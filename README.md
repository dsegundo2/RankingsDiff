# Rankings Diff

## Snake Draft with Fantasy Pros

1. Download the correct input files to the CSV data directory
2. Make sure the variable constants are set correctly in `rankings_diff.py`
3. run `python rankings_diff.py`

## Recommended Actions for the CSV
1. Fit cells to the size of the text
2. Optional, alternate column coloring of rows
3. For Auction, add a currency format to the last two columns
4. Insert a column for check-boxes if marking things on a computer (and maybe conditional formatting for the box)
5. If printing, may want to mark the round cutoffs

## Auction Draft with ESPN

Download base rankings and suggested auction value
- [Third-Party Google Sheet](https://docs.google.com/spreadsheets/d/149NUwr9QRggJrdtuk2KG_eo-jXSOjEU1XCfUSHcBINw/edit?usp=sharing) - Used `JSONexport` sheet on the first run
- Double-check if you should use the standard index or the PPR index to sort. Looks like the Standard rankings are used for the cheat sheet with auction values. Might just be the cheat sheet pdf
  - We may consider to sort by the dollar amount with the secondary sort by position

## Actions this time
 - Freeze the menu row
 - Add 2 more sheets. One for kicker def, one for positional that is an alias cataloged
  