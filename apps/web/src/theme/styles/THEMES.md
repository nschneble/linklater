# Linklater Themes

There are ten themes, each with light and dark variants. Two parallel
token systems are active:

## 1. Flat tokens (legacy, all 10 themes)

Each theme variant defines 10 flat color variables that the bulk of the
UI still reads:

| Variable         | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `--bg`           | Base background                                             |
| `--bg-surface`   | Raised surfaces: cards, panels, modals                      |
| `--bg-elevated`  | Further elevated: drop-downs, skeletons, inactive tab fills |
| `--text`         | Primary readable text                                       |
| `--text-muted`   | Secondary/supporting text: labels, subtitles, placeholders  |
| `--text-subtle`  | De-emphasized text: urls, helper hints, section dividers    |
| `--border`       | All borders and dividers                                    |
| `--accent`       | Primary brand color: active indicators, icons, focus rings  |
| `--accent-hover` | Accent hover state                                          |
| `--accent-fg`    | Foreground text on accent-colored backgrounds               |

`--bg-input` was retired in wave 23 of the theme refactor. Form input
backgrounds now live on the bundle slots `--base-input-bg` and
`--mount-input-bg` (see Section 2 below).

## 2. Color bundles (in-progress migration)

A **bundle** is a complete palette for one kind of UI surface. The system
exposes seven bundles, each carrying five values:

| Bundle    | Where it's used         |
| --------- | ----------------------- |
| `base`    | Page chrome             |
| `mount`   | Cards, settings panels  |
| `orbit`   | Menus, dropdowns        |
| `alert`   | Errors, danger zones    |
| `warn`    | Yellow banners          |
| `info`    | Tips, hints             |
| `success` | Verified badges, toasts |

For bundle `X` the variables are `--X-bg`, `--X-border`, `--X-text`,
`--X-alt-text`, and `--X-highlight`. See `bundles.css` for the full
definition. Bundle tokens that aren't theme-overridden fall through to
sensible defaults: `base`/`mount`/`orbit` track the flat
`--bg`/`--bg-surface`/`--bg-elevated`, and `alert`/`warn`/`info`/`success`
use neutral rose/amber/blue/emerald hues with a light/dark switch.

Per-theme bundle palettes shipped so far:

- `school-of-rock` (pilot — both modes)
- `apollo-10-1-2` (CVD-mandated — both modes)

The remaining 8 themes use the default bundle palettes until each is
migrated.

### Bundle contrast targets (WCAG 2.2)

When tuning a per-theme bundle palette, every pair must clear:

- `--X-text` and `--X-alt-text` on `--X-bg`: **AA** (≥ 4.5 : 1)
- `--X-border` and `--X-highlight` on `--X-bg`: **3 : 1** (SC 1.4.11)
- `--X-border` on `--base-bg` (when the bundle renders as a card on the
  page): **3 : 1** — the most-missed check

Verify per-pair with a contrast calculator; visually eyeballing borders
fails reliably.

## Contrast targets

When adding or tuning a theme, meet these WCAG thresholds:

- `--text` and `--text-muted` on `--bg` / `--bg-surface`: **AAA**
  (≥ 7 : 1 for normal text, ≥ 4.5 : 1 for large text)
- `--accent-fg` on `--accent` and `--accent-hover`: **AA**
  (≥ 4.5 : 1 for normal text)

Verify with any WCAG contrast checker (e.g. https://webaim.org/resources/contrastchecker/).
The `--text-subtle` token is intentionally lower-contrast — it is
used only for de-emphasized metadata (URLs, hints, dividers), not
primary readable content.

## `swatchIcon` field

Every entry in the `THEMES` array (defined in
`apps/web/src/theme/ThemeContext.tsx`) carries a `swatchIcon` field — a
Font Awesome class name (e.g. `fa-rocket`) that is overlaid on the accent
color dot in the theme picker for quick visual identification without
relying on color alone.

## Apollo 10½ CVD palette

Apollo's CVD-distinguishable status colors now live in the standard
bundle cascade (`bundles.css`), not in per-component overrides. The
palette is hand-tuned to satisfy the bundle distinguishability contract
without any `SHAPE_REDUNDANCY_WAIVERS` entries — every state-pair passes
axis A (dE2000 ≥ 10 under all three dichromacies) or axis B (luminance
gap ≥ 1.4x).
