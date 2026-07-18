# RankingsDiff UI style guide

## Principles

- **Dense, not cramped.** Use the 4px spacing scale and keep a 12px default gap.
- **Fun, not noisy.** Position colors identify categories; blue-violet identifies interaction; warm gradients add energy without encoding meaning.
- **Data stays aligned.** Player text is left-aligned. Ranks, prices, and differences are right-aligned with tabular numerals.
- **One signal per job.** Position uses pills. Value magnitude uses the right-edge row glow. Draft state uses opacity and a clear label.
- **Progressive disclosure.** The draft board is the detailed view; position lanes are the glanceable overview.

## Tokens

- Spacing: `4, 8, 12, 16, 24, 32, 48px` only.
- Radius: `10px` controls, `16px` panels, `999px` tags.
- Type: sentence case; weights `500, 650, 800`; tabular numerals for data.
- Surfaces: one elevated layer per section. Do not nest floating cards.
- Color: use CSS variables in `styles.css`; never add raw category colors inside components.

## Interaction

- Every icon-only action needs an accessible name and visible focus state.
- Targets remain available through search and position filtering.
- Draft actions are reversible and cached per season/sheet.
- Mobile keeps Player, Position, Edge, Target, and Draft actions visible before secondary ranking detail.

## Review checklist

- No arbitrary spacing, radii, or new colors.
- No red/green rails or color-only meaning.
- No centered numeric columns.
- No clipped labels at 320, 390, 768, 1180, or 1440px.
- Keyboard focus, hover, empty, filtered, targeted, and drafted states are tested.
