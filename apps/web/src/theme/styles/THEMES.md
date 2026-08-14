# Linklater Themes

There are eleven selectable themes: ten film themes (each with light and
dark variants) plus the user-editable `custom` theme (Section 7), as well
as one off-book brand-chrome theme that no user can pick (Section 7). Every
consumer now paints from the bundle vocabulary (Section 2) or the
universal `--focus-ring` slot (Section 3); the legacy flat-token surface
has been retired in stages.

## 1. Flat tokens (legacy, fully retired in chrome)

Twelve flat tokens have been retired:

- `--bg-input` – form input backgrounds now live on the bundle
  slots `--base-input-bg` and `--mount-input-bg`. See Section 2.
- `--bg-elevated` – over-card surfaces (drop-downs, inactive tab
  fills) now lift one tier via `--orbit-bg`. See Section 2.
- `--bg`, `--bg-surface`, `--text-subtle`, `--border` – fully
  superseded by the `--base-*` / `--mount-*` / `--orbit-*` bundle slots.
- `--text`, `--text-muted` – page-chrome text now lives on
  `--base-text` / `--mount-text` / `--orbit-text` and their `-alt-text`
  pairs. Page-gradient consumers read `--page-gradient-from` and
  `--page-gradient-to` directly per theme.
- `--accent-fg`, `--accent-hover` – primary-button foreground
  - hover now resolve per host tier via `--{base,mount,orbit}-highlight-fg`
    and `--{base,mount,orbit}-highlight-hover`. `PrimaryButton` gained a
    `surface` prop to pick the right pair. See Section 5.
- `--accent` – the last chrome consumers migrated to
  `--mount-highlight`, `--base-highlight`, and `--orbit-highlight`
  depending on host; the per-theme `--accent`
  declarations and the alias chain in the `bundles.css :root`
  synthetic fallback are gone. `default.css` is fully sunset (its last
  two slots – `--theme-transition-duration` /
  `--theme-transition-easing` – moved to `bundles.css :root`).
- `--page-gradient-via` – the mid-stop was byte-identical to
  `--page-gradient-from` in every shipped theme, so the auth / verify
  page-gradient wrappers collapsed to a 2-stop `bg-gradient-to-b
from-{from} to-{to}` and the slot was retired across all 10 themes.

The `chrome-token-migration.test.ts` tripwire keeps every retired token
in its `LEGACY_TOKENS` list to prevent re-introduction.

## 2. Color bundles (all 10 film themes migrated)

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

- `--base-subtle-text` – lowest-emphasis page-chrome text (kbd legends,
  hints, chevrons). Base bundle only.
- `--base-input-bg`, `--mount-input-bg` – per-surface form-input fill.
  Base and mount bundles only; orbit and state bundles don't host inputs.

All 10 themes ship per-theme bundle palettes – each lives in the
corresponding per-theme `.css` file (e.g. `apollo-10-1-2.css`). The
default cascade in `bundles.css :root` exists as a fallback for the
synthetic "no theme set" case – explicit hex pins for any code path
that runs before a theme attribute is set on `<html>`.

### Bundle contrast targets (WCAG 2.2)

When tuning a per-theme bundle palette, every pair must clear:

- `--X-text`, `--X-alt-text`, `--base-subtle-text` on `--X-bg`: **AA**
  (≥ 4.5 : 1, SC 1.4.3)
- `--X-border`, `--X-highlight` on `--X-bg`: **3 : 1** (SC 1.4.11)
- `--X-highlight-fg` on `--X-highlight` AND on `--X-highlight-hover`:
  **AA** (≥ 4.5 : 1, SC 1.4.3) – same fg legible through hover
- `--X-border` on `--base-bg` for card-style bundles (mount, orbit,
  alert, warn, info, success): **3 : 1** – the most-missed check
- `--X-text`, `--X-alt-text`, `--X-border` on `--X-input-bg` for base
  and mount: **AA / AA / 3 : 1**

`bundles.contrast.test.ts` mechanizes every contract above for every
shipped theme. Eyeballing borders fails reliably – let the test catch
drift.

## 3. Universal focus ring (`--focus-ring`)

Every theme variant defines `--focus-ring` – a single slot driving the
`:focus-visible` ring color across all surfaces. Every theme-mode block
ships an explicit hex (a prior
`--focus-ring: var(--accent)` alias broke once `--accent` was retired
entirely). Most theme-mode blocks pick the same hex their `--accent`
historically used; apollo-10-1-2 dark uses `#70b0e0` instead – the
original accent collapsed against `--orbit-bg`. The `bundles.css :root`
synthetic fallback omits the slot (no consumer paints before a theme
attribute is set on `<html>`); `bundles.contrast.test.ts` returns null
for that fixture and lets the per-theme cascades carry the SC 1.4.11
contract.

Per-bundle overrides via the consumer-side pattern
(`--focus-ring-on-{bundle}`) are supported but currently unused –
culori verification confirms the universal value clears 3 : 1
against every surface.

## 4. Modal scrim (`@utility scrim`)

`bundles.css` defines a `scrim` Tailwind utility that paints the single
backdrop used by every overlay – `WelcomeModal`, `KeyboardShortcutsModal`,
`LinksView`'s link-form backdrop, and `MobileBottomSheet`. The literal
value is theme-independent today (`rgb(0 0 0 / 0.5)`); promote to
`var(--scrim, rgb(0 0 0 / 0.5))` when a theme needs to opt out.

## 5. The `surface` prop pattern

Five common components expose a `surface` prop (`FormInput`,
`SlidingTabBar`, `IconButton`, `LinkButton`, `PrimaryButton`); a sixth,
`TabButton`, picks up its host from its parent `SlidingTabBar`'s
`data-surface` attribute via Tailwind `group-data-*` variants – see the
paragraph below. The prop selects which bundle's tokens drive the
component's colors, keeping fill / border / text coherent with the
bundle it visually sits on:

- `surface="base"` – page chrome (default for `FormInput` and
  `SlidingTabBar`; used by `LinkForm`, `LinksList`'s load-more button,
  `LinksToolbar`, `StumblePage`, `StumbleEmptyView`, and the
  `PrimaryButton`s in `FailWhalePage`, `ErrorFallbackView`, `NotFoundView`,
  `LinksControls`, `LinksMobileControls`, `LinkForm`). `ApiDocsView`
  and `LandingPage` paint from the off-book `branding` theme (Section 7):
  their wrappers set `data-theme='branding'` so every bundle slot
  resolves to the marketing palette, and their inner components consume
  bundle tokens like any other surface.
- `surface="mount"` – inside a card (default for `IconButton`,
  `LinkButton`, and `PrimaryButton`; used by every settings-form
  `FormInput`, `AuthForm` inputs inside `AuthCard`, and most in-card
  buttons)
- `surface="orbit"` – inside a lifted menu or row (used by
  `ApiTokenRow` IconButtons inside the orbit-tier row, and the
  `WelcomeModal` `PrimaryButton`s painting on its orbit-tier callout
  cards). `KeyboardShortcutsModal` is also orbit-tier but paints
  directly off `--orbit-bg` / `--orbit-text` / `--orbit-alt-text`
  rather than going through `surface`-aware components.
- `surface="warn"` (LinkButton only) – inside the email verification
  banner in `AppShell`

`TabButton` deliberately has no `surface` prop – it reads its parent
`SlidingTabBar`'s `data-surface` attribute via Tailwind `group-data-*`
variants, so the tab bar and its labels stay coherent without prop
plumbing.

`IconButton` adds a second axis: the `variant` prop splits into
host-driven variants (`default`/`ghost`/`elevated` paint from the
`surface`) and intrinsic variants (`danger`/`danger-filled` paint from
the alert bundle regardless of host). `Toast` deliberately omits the
prop – it is viewport-fixed and the `variant` drives the paint via the
state-bundle highlight slots.

Picking the wrong surface breaks the bundle-contrast contract – the
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
`SHAPE_REDUNDANCY_WAIVERS` entries – every state-pair passes axis A
(dE2000 ≥ 10 under all three dichromacies) or axis B (luminance gap
≥ 1.4×).

## 7. The `custom` theme and the off-book `branding` theme

### The user-editable `custom` theme

`custom` is the eleventh selectable theme, but unlike the ten film themes it
has no `.css` file. Its `{dark, light}` palette of `--{bundle}-{slot}` tokens
(plus the universal `--focus-ring`) lives in the per-user `customTheme` JSON
column, is edited in the Theme Editor, and is injected onto
`document.documentElement` at runtime while `custom` is the active theme. It is
deliberately NOT part of the `bundles.contrast.test.ts` fixtures because the
palette is user-authored — contrast can't be validated against a fixed file.
Instead it is validated live in the editor's contrast checker (Section 2's
WCAG contracts, computed per edit), and per-token failures surface inline on
each color input.

### The off-book `branding` theme

`branding.css` defines a twelfth `data-theme` value, `branding`, that is
deliberately NOT one of the ten selectable themes. It is absent from the
`BaseTheme` union, `THEMES`, `VALID_BASE_THEME_IDS` (`constants.ts`), and
the API `VALID_THEMES` list, so no user can ever activate it and it never
appears in the theme editor. It paints only where a wrapper sets
`data-theme='branding'` directly: the marketing `LandingPage`, the
logged-out API-docs page (`ApiDocsView`), and the `Common` fallback
wrappers. When a user is logged in, their active theme overrides it.

Do NOT "fix" branding by registering it in the lists above — that would
make it selectable and break the invisibility contract. It is dark-locked
(a single `[data-theme='branding']` block, no `[data-mode]` qualifier),
since the marketing chrome is navy-on-dark regardless of OS/app mode.
Its palette is still a full bundle vocabulary and is WCAG-verified in
`bundles.contrast.test.ts` as a mode-independent fixture. See the header
comment in `branding.css` for the full rationale (border-hue choice,
omitted `--page-gradient-*` slots, focus-ring pin).

## `swatchIcon` field

Every entry in the `THEMES` array (defined in
`apps/web/src/theme/constants.ts`) carries a `swatchIcon` field – a
Font Awesome class name (e.g. `fa-rocket`) overlaid on the accent color
dot in the theme picker, so the picker stays usable without relying on
color alone.
