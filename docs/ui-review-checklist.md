# RankingsDiff UI review checklist

Use this checklist before finalizing UI changes. Prefer screenshots or browser inspection at desktop and mobile widths when layout changes are visible.

## Desktop layout

- [ ] Dashboard shell is centered and does not exceed the intended max width.
- [ ] Hero, search/settings area, toolbar, table/lanes, and target queue align cleanly.
- [ ] Sticky headers and sticky target queue behavior still feel intentional.
- [ ] There is no unnecessary nesting of elevated cards.

## Mobile layout

Check at 390px and 320px wide.

- [ ] No horizontal overflow.
- [ ] Search, settings, view switcher, filters, draft controls, and target queue are reachable.
- [ ] Table or lane columns do not collide or clip important labels.
- [ ] Dialogs fit within the viewport and actions remain tappable.
- [ ] Touch targets are comfortably sized.

## Spacing rhythm

- [ ] New spacing follows the 4/8px scale.
- [ ] Related controls have consistent gaps.
- [ ] Section spacing is clear without creating excessive vertical scrolling.
- [ ] No new arbitrary one-off margins/padding were added without a reason.

## Alignment

- [ ] Player text is left-aligned.
- [ ] Ranks, prices, differences, and counts use tabular numerals and align consistently.
- [ ] Chips, badges, logos, and row actions are vertically centered.
- [ ] Table headers align with body columns.

## Hierarchy

- [ ] The most important data remains visually dominant.
- [ ] Primary actions are used sparingly.
- [ ] Labels, headings, and helper text use consistent type roles.
- [ ] Decorative surfaces do not compete with the rankings table or position lanes.

## Component consistency

- [ ] Existing button, card, field, badge, table, dialog, and panel patterns were reused where possible.
- [ ] New visual variants are documented in `docs/design-system.md` if they are durable.
- [ ] No duplicated near-identical component styles were introduced.
- [ ] Dead or unused UI paths were not expanded without a plan.

## Color and contrast

- [ ] New colors use semantic CSS tokens.
- [ ] Text and interactive states have sufficient contrast.
- [ ] Color is not the only indicator of status, diff, draft state, or target state.
- [ ] Position colors remain consistent across table, lanes, badges, and filters.

## Focus, hover, and active states

- [ ] Keyboard focus is visible on every interactive element.
- [ ] Hover states are consistent with the design system.
- [ ] Active/pressed states are clear for toggles, tabs, target buttons, and draft buttons.
- [ ] Dialogs have predictable close behavior.

## Empty, loading, and error states

- [ ] Loading state is calm and specific.
- [ ] Error state provides useful copy and recovery action when possible.
- [ ] Empty filtered results explain why no data is shown.
- [ ] Empty target/source-health states are visually consistent with other panels.

## Chart/table/data readability

- [ ] Data remains scannable at desktop and mobile widths.
- [ ] Diff/value treatments do not overpower text.
- [ ] Sorting labels and source labels are understandable.
- [ ] Sticky table headers still work after scrolling.

## One-off style review

- [ ] No new raw hex colors, shadows, radii, or spacing values were added unnecessarily.
- [ ] New tokens are named by purpose, not by visual appearance only.
- [ ] CSS selectors are scoped enough to avoid affecting future unrelated components.

## Required verification commands

Run the relevant commands before final handoff:

```bash
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
npm --prefix frontend run test:ui
```

Preferred UI command when available:

```bash
asdf exec npm --prefix frontend run test:ui
```

If UI tests or browser checks cannot run, record the exact command attempted and the blocker.
