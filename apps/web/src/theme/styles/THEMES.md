# Linklater Themes

There are eight themes, each with light and dark variants. Each theme variant is comprised of 11 individual color styles:

| Variable         | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `--bg`           | Base background                                             |
| `--bg-surface`   | Raised surfaces: cards, panels, modals                      |
| `--bg-elevated`  | Further elevated: drop-downs, skeletons, inactive tab fills |
| `--bg-input`     | Form input backgrounds                                      |
| `--text`         | Primary readable text                                       |
| `--text-muted`   | Secondary/supporting text: labels, subtitles, placeholders  |
| `--text-subtle`  | De-emphasized text: urls, helper hints, section dividers    |
| `--border`       | All borders and dividers                                    |
| `--accent`       | Primary brand color: active indicators, icons, focus rings  |
| `--accent-hover` | Accent hover state                                          |
| `--accent-fg`    | Foreground text on accent-colored backgrounds               |

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

## Apollo 10½ state variables

The Apollo 10½ theme (`apollo-10-1-2.css`) is the only theme that defines
`--state-*` variables. These are Apollo-specific overrides used by
`Alert`, `StatusBadge`, and `Toast` to ensure CVD-distinguishable
status colors; they are not part of the shared 11-variable contract above.

| Variable             | Purpose                                |
| -------------------- | -------------------------------------- |
| `--state-danger`     | Background for danger / error states   |
| `--state-danger-fg`  | Foreground text on danger backgrounds  |
| `--state-success`    | Background for success states          |
| `--state-success-fg` | Foreground text on success backgrounds |
| `--state-warning`    | Background for warning states          |
| `--state-warning-fg` | Foreground text on warning backgrounds |
| `--state-info`       | Background for informational states    |
| `--state-info-fg`    | Foreground text on info backgrounds    |

Other themes do not declare these variables; components fall back to
hue-only accent colors on all non-Apollo themes.
