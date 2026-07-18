# RankingsDiff design system

RankingsDiff is a dense fantasy-football rankings comparison dashboard. The UI should feel like a professional draft command center: fast, data-first, trustworthy, and lightly energetic without becoming decorative or noisy.

This document describes the design system that exists in the app today and the rules future UI work should preserve.

## Brand and product feel

- **Data-first:** rankings, prices, differences, and draft state are the product. Decorative treatments must not compete with the table or position lanes.
- **Dense, not cramped:** fit many players on screen while preserving clear scanning, alignment, and touch targets.
- **Polished, not trendy:** use soft surfaces, restrained gradients, clear contrast, and short interaction feedback. Avoid isolated special sections, random gradients, or novelty effects.
- **Fantasy-sports energy:** position colors and the blue-violet accent add category recognition and action emphasis.

## Typography

- Use the existing system sans stack from `frontend/src/styles.css`.
- Keep the large `RankingsDiff` wordmark/display heading on primary dashboard views.
- Use sentence case for copy and labels except established uppercase eyebrows/metadata labels.
- Use consistent roles:
  - **Display:** dashboard wordmark/title; tight tracking is acceptable here only.
  - **Section title:** compact, bold, clear nouns.
  - **Body:** normal sentence text with comfortable line height.
  - **Label/eyebrow:** small, uppercase, bold, letter-spaced.
  - **Data numeric:** tabular numerals, right-aligned in tables and lanes.
- Avoid adding new arbitrary font weights. Prefer existing weights around `650`, `750`, and `800` for UI text.

## Colors

Core tokens live in `:root` in `frontend/src/styles.css`.

- `--ink`: primary text
- `--muted`: secondary text
- `--surface`: app background
- `--panel`: primary elevated surface
- `--panel-soft`: subtle/inset surface
- `--line`: borders and dividers
- `--accent`, `--accent-2`, `--accent-soft`: main interaction color family
- `--good`, `--warning`, `--danger`: semantic status colors
- `--target-*`: shortlist/favorite affordance colors
- `--qb`, `--rb`, `--wr`, `--te`: position identity colors

Rules:

- Do not add raw category/status colors inside React components.
- Add a semantic CSS token before introducing a recurring color.
- Do not use red/green as the only indicator of meaning; include labels, signs, icons, or position text.
- Keep position colors for recognition, not decoration.

## Spacing

Use a 4/8px rhythm. Preferred spacing tokens:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-12`: 48px

Small optical exceptions may exist in the legacy CSS, but new work should avoid introducing additional one-off spacing values.

## Radius

Preferred radius tokens:

- `--radius-sm`: 8px, tight data badges or compact controls
- `--radius-md`: 10px, default controls
- `--radius-lg`: 16px, panels/cards/toolbars
- `--radius-xl`: 20px, dialogs and large marks
- `--radius-2xl`: 24px, large shells/popovers
- `--radius-pill`: 999px, chips and pills

Use fewer radius sizes inside a single feature. Avoid creating a new radius for one component.

## Shadows and elevation

Preferred elevation tokens:

- `--shadow-sm`: compact controls or subtle raised links
- `--shadow-md`: toolbars, small panels, section cards
- `--shadow-lg`: main panels/tables/queues
- `--shadow-xl`: modal/dialog overlays

Rules:

- Use one elevated layer per section when possible.
- Avoid nested floating cards unless the hierarchy requires it.
- Use shadows to separate functional layers, not as decoration.

## Layout and grid

- Dashboard content should remain centered with a max-width around the current `1440px` shell.
- Use CSS grid for major page composition and data lanes.
- Make mobile, tablet, and desktop behavior explicit in CSS.
- Preserve the product structure: hero/search/settings, draft toolbar, table or position lanes, optional target queue.
- Avoid layout changes that reduce visible data without a clear usability benefit.

## Buttons and actions

Existing button patterns include primary, secondary, danger/clear, icon, target, draft, and segmented tab actions.

Rules:

- Prefer existing button classes before adding new variants.
- Use consistent heights, radii, font weight, hover, active, and focus behavior.
- Icon-only buttons require an accessible name.
- Destructive actions use danger styling and clear copy.
- Primary actions should be rare; most dashboard controls should remain secondary/subtle.

## Cards and panels

Common surfaces include dashboard panels, settings sections, source checks, target queue, position lanes, and loading/error shells.

Rules:

- Use `--panel`, `--panel-soft`, `--line`, radius tokens, and shadow tokens.
- Keep cards purposeful: one card should group one meaningful decision or data unit.
- Avoid placing multiple unrelated controls in visually identical cards without clear labels.

## Forms

- Labels should be visible and concise.
- Inputs and selects use the same border, radius, focus ring, and font treatment.
- Helper/error text should sit near the relevant control.
- File inputs may be visually hidden only when triggered by an accessible button.
- Toggles should expose state through the native control plus visible label.

## Tables

Tables are the primary data surface.

- Player names are left-aligned.
- Ranks, prices, and differences are right-aligned with tabular numerals.
- Headers may be sticky when row scrolling is expected.
- Keep row dividers subtle and consistent.
- Avoid centered numeric columns unless the value is categorical.
- Diff treatments should support scanning without overpowering text.
- Empty table states should explain the current filter result and how to recover when needed.

## Charts and data displays

There are no dedicated chart components today. If charts or diagrams are added:

- Use them only when they improve comprehension.
- Prefer direct labels over hidden legends.
- Use semantic and position colors from tokens.
- Keep scales, axes, and sort order obvious.
- Do not introduce decorative chart gradients or 3D effects.

## Navigation and tabs

- The current view switcher is a segmented control between draft board and position overview.
- Keep tab labels short and descriptive.
- Selected, hover, focus, and pressed states must be visible.
- Do not add new navigation structures unless the app gains genuinely separate workflows.

## Modals and dialogs

Existing dialogs include settings and draft clearing confirmation.

Rules:

- Use a consistent overlay, panel radius, shadow, header, body, and action footer.
- Dialogs need an accessible name via heading/`aria-labelledby`.
- Escape and backdrop-close behavior should be predictable.
- Future dialog work should add or preserve focus management/focus trapping.

## Empty, loading, and error states

- Loading should be calm and specific about what is loading.
- Error states should explain the problem and offer a retry where possible.
- Empty states should name the cause: no source data, no matching filters, no targets, etc.
- Use the same typography, panel, and action rules as the rest of the app.

## Responsive rules

Verify at minimum:

- 1440px desktop
- 768px tablet
- 390px mobile
- 320px narrow mobile

Rules:

- No horizontal overflow.
- Search, settings, view switching, position filters, draft controls, target queue, and dialogs must remain usable.
- Touch targets should remain large enough on mobile.
- Data columns may be simplified on mobile, but Player, Position, key comparison metric, Target, and Draft state should remain understandable.

## Accessibility rules

- All interactive controls need visible focus states.
- Do not rely on color alone for status or comparison meaning.
- Maintain readable contrast for muted text, chips, target states, and diff states.
- Icon-only actions need accessible labels.
- Dialogs need accessible names and predictable keyboard behavior.
- Respect reduced motion preferences for non-essential animation.

## Do / don't examples

Do:

- Reuse `.primary-action`, `.secondary-action`, `.danger-action`, `.draft-action`, `.target-action`, `.pos-chip`, `.team-badge`, and panel patterns.
- Add a named token before using a recurring color, shadow, or radius.
- Keep numeric data right-aligned and tabular.
- Test desktop and mobile after visual changes.

Don't:

- Add random gradients or isolated special cards.
- Add new raw hex colors inside components.
- Center numeric rank/price/diff columns.
- Introduce one-off spacing/radius values for a single component.
- Hide important mobile actions behind unclear icons.
