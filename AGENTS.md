# AI contributor instructions

## Releases

- Use [Semantic Versioning](https://semver.org/) for every release: `MAJOR.MINOR.PATCH`.
- The initial semantic release is `1.0.0` and its Git tag is `v1.0.0`.
- After `1.0.0`, select each version by the scope of the change: increment `PATCH` for backward-compatible fixes, `MINOR` for backward-compatible features, and `MAJOR` for breaking changes.
- Do not use dates, workflow run numbers, or other non-semantic values as release versions.
- When requested to make app changes, commit the completed work and cut the appropriate Semantic Versioning release as part of the standard handoff unless the user explicitly says not to.

## UI design system

- Treat RankingsDiff as a professional, data-first fantasy draft dashboard: dense, polished, readable, and restrained.
- Before broad visual changes, audit existing components and follow `docs/design-system.md` plus `docs/ui-review-checklist.md`.
- Prefer existing UI patterns before adding new components or variants.
- Use semantic CSS tokens for color, spacing, radius, shadows, and status states; avoid new raw hex colors or one-off values in components.
- Keep typography hierarchy, tabular numeric alignment, button treatments, cards, tables, dialogs, and position colors consistent.
- Make responsive behavior explicit for desktop, tablet, and mobile; verify there is no horizontal overflow at narrow widths.
- Preserve accessibility: visible focus states, accessible names for icon-only actions, adequate contrast, and no color-only meaning.
- Do not redesign the whole product at once. Keep UI changes scoped, reviewable, and covered by lint/tests plus Chromium UI checks when UI changes are made.
