# Linklater Themes

There are ten themes, each with light and dark variants. Two parallel
token systems are active:

## 1. Flat tokens (legacy, all 10 themes)

Each theme variant defines three flat color variables that the
un-migrated accent-outline consumers still read:

| Variable         | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `--accent`       | Primary brand color: active indicators, icons, focus rings |
| `--accent-hover` | Accent hover state                                         |
| `--accent-fg`    | Foreground text on accent-colored backgrounds              |

Eight flat tokens have been retired:

- `--bg-input` (wave 23) — form input backgrounds now live on the bundle
  slots `--base-input-bg` and `--mount-input-bg`. See Section 2.
- `--bg-elevated` (wave 32) — over-card surfaces (drop-downs, skeletons,
  inactive tab fills) now lift one tier via `--orbit-bg`. See Section 2.
- `--bg`, `--bg-surface`, `--text-subtle`, `--border` (wave 36) — fully
  superseded by the `--base-*` / `--mount-*` / `--orbit-*` bundle slots.
- `--text`, `--text-muted` (wave 40) — page-chrome text now lives on
  `--base-text` / `--mount-text` / `--orbit-text` and their `-alt-text`
  pairs. Page-gradient consumers read `--page-gradient-from`,
  `--page-gradient-via`, `--page-gradient-to` directly per theme.

The `chrome-token-migration.test.ts` tripwire keeps all eight in its
`LEGACY_TOKENS` list to prevent re-introduction.

## 2. Color bundles (all 10 themes migrated)

A **bundle** is a complete palette for one kind of UI surface. The seven
bundles map onto the UI's narrative surfaces:

| Bundle    | Where it's used         |
| --------- | ----------------------- |
| `base`    | Page chrome             |
| `mount`   | Cards, settings panels  |
| `orbit`   | Menus, dropdowns        |
| `alert`   | Errors, danger zones    |
| `warn`    | Yellow banners          |
| `info`    | Tips, hints             |
| `success` | Verified badges, toasts |

For bundle `X` the slots are `--X-bg`, `--X-border`, `--X-text`,
`--X-alt-text`, `--X-highlight`, `--X-highlight-fg`, and
`--X-highlight-hover`. `bundles.css` documents the per-slot WCAG
contracts and the highlight-fg / hover pair contract; each theme's
per-theme `.css` file in this directory hosts that theme's bundle
palette block.

Three slots are bundle-restricted:

- `--base-subtle-text` — lowest-emphasis page-chrome text (kbd legends,
  hints, chevrons). Base bundle only.
- `--base-input-bg`, `--mount-input-bg` — per-surface form-input fill.
  Base and mount bundles only; orbit and state bundles don't host inputs.

All 10 themes ship per-theme bundle palettes — each lives in the
corresponding per-theme `.css` file (e.g. `apollo-10-1-2.css`). The
default cascade in `bundles.css :root` exists as a fallback for the
synthetic "no theme set" case — explicit hex pins for any code path
that runs before a theme attribute is set on `<html>`.

### Bundle contrast targets (WCAG 2.2)

When tuning a per-theme bundle palette, every pair must clear:

- `--X-text`, `--X-alt-text`, `--base-subtle-text` on `--X-bg`: **AA**
  (≥ 4.5 : 1, SC 1.4.3)
- `--X-border`, `--X-highlight` on `--X-bg`: **3 : 1** (SC 1.4.11)
- `--X-highlight-fg` on `--X-highlight` AND on `--X-highlight-hover`:
  **AA** (≥ 4.5 : 1, SC 1.4.3) — same fg legible through hover
- `--X-border` on `--base-bg` for card-style bundles (mount, orbit,
  alert, warn, info, success): **3 : 1** — the most-missed check
- `--X-text`, `--X-alt-text`, `--X-border` on `--X-input-bg` for base
  and mount: **AA / AA / 3 : 1** (input contract added wave 22b)

`bundles.contrast.test.ts` mechanizes every contract above for every
shipped theme. Eyeballing borders fails reliably — let the test catch
drift.

## 3. Universal focus ring (`--focus-ring`)

Every theme variant defines `--focus-ring` — a single slot driving the
`:focus-visible` ring color across all surfaces. Aliased to `--accent`
on every theme today except apollo-10-1-2 dark, where the default
accent collapses against `--orbit-bg` and an explicit hex is used.
Per-bundle overrides via the consumer-side pattern
(`--focus-ring-on-{bundle}`) are supported but currently unused —
culori verification (wave 21) confirms the universal value clears 3 : 1
against every surface.

## 4. Modal scrim (`@utility scrim`)

`bundles.css` defines a `scrim` Tailwind utility that paints the single
backdrop used by every overlay — `WelcomeModal`, `KeyboardShortcutsModal`,
`LinksView`'s link-form backdrop, and `MobileBottomSheet`. The literal
value is theme-independent today (`rgb(0 0 0 / 0.5)`); promote to
`var(--scrim, rgb(0 0 0 / 0.5))` when a theme needs to opt out.

## 5. The `surface` prop pattern

Four common components expose a `surface` prop (`FormInput`,
`SlidingTabBar`, `IconButton`, `LinkButton`); a fifth, `TabButton`,
infers its host from its parent — see the paragraph below. The prop
selects which bundle's tokens drive the component's colors, keeping
fill / border / text coherent with the bundle it visually sits on:

- `surface="base"` — page chrome (default for `FormInput` and
  `SlidingTabBar`; used by `LinkForm`, `LinksList`'s load-more button,
  `LinksToolbar`, `StumblePage`, `StumbleEmptyView`, `ApiDocsView`,
  `TokenInput`)
- `surface="mount"` — inside a card (default for `IconButton` and
  `LinkButton`; used by every settings-form `FormInput`, `AuthForm`
  inputs inside `AuthCard`, and most in-card buttons)
- `surface="orbit"` — inside a lifted menu or row (used by
  `ApiTokenRow` IconButtons inside the orbit-tier row). `WelcomeModal`
  and `KeyboardShortcutsModal` are also orbit-tier surfaces but paint
  directly off `--orbit-bg` / `--orbit-text` / `--orbit-alt-text`
  rather than going through `surface`-aware components.
- `surface="warn"` (LinkButton only) — inside the email verification
  banner in `AppShell`

`TabButton` deliberately has no `surface` prop — it reads its parent
`SlidingTabBar`'s `data-surface` attribute via Tailwind `group-data-*`
variants, so the tab bar and its labels stay coherent without prop
plumbing.

`IconButton` adds a second axis: the `variant` prop splits into
host-driven variants (`default`/`ghost`/`elevated` paint from the
`surface`) and intrinsic variants (`danger`/`danger-filled` paint from
the alert bundle regardless of host). `Toast` deliberately omits the
prop — it is viewport-fixed and the `variant` drives the paint via the
state-bundle highlight slots.

Picking the wrong surface breaks the bundle-contrast contract — the
component reads tokens validated against the wrong bg. The host bundle
is the rendering parent's surface, NOT the importing module's directory
(an `AuthForm` `FormInput` is mount because `AuthCard` is a mount-tier
card, even though it lives under `auth/`). When adding a new
bundle-aware component, follow this pattern and add a clause to
`bundles.contrast.test.ts` if a new fg/bg pair is introduced.

## 6. Apollo 10½ CVD palette

Apollo's CVD-distinguishable status colors live in the standard bundle
cascade, not in per-component overrides. The palette is hand-tuned to
satisfy the bundle distinguishability contract without any
`SHAPE_REDUNDANCY_WAIVERS` entries — every state-pair passes axis A
(dE2000 ≥ 10 under all three dichromacies) or axis B (luminance gap
≥ 1.4×).

## Flat-token contrast targets

When adding or tuning a theme, the surviving flat tokens must also meet:

- `--accent-fg` on `--accent` and `--accent-hover`: **AA** (≥ 4.5 : 1)

## `swatchIcon` field

Every entry in the `THEMES` array (defined in
`apps/web/src/theme/ThemeContext.tsx`) carries a `swatchIcon` field — a
Font Awesome class name (e.g. `fa-rocket`) overlaid on the accent color
dot in the theme picker, so the picker stays usable without relying on
color alone.
