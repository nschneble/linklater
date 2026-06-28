/**
 * The Custom theme's DARK starting palette: a snapshot of the off-book
 * `branding` theme's tokens (branding.css `[data-theme='branding']`). A freshly
 * enabled Custom theme has no saved tokens, so its dark mode falls back to
 * these instead of the synthetic `:root` defaults — the Custom theme "defaults
 * to branding". The light counterpart is `BRANDING_DEFAULTS_LIGHT` below.
 *
 * Keyed by the same CSS variable names as `CUSTOM_TOKEN_KEYS`, so these values
 * flow through the exact same allowlisted injection path as user-saved tokens —
 * they never become a trusted bypass. This map is the canonical RUNTIME source;
 * `brandingDefaults.drift.test.ts` asserts it stays byte-for-byte in sync with
 * branding.css so the two can never silently diverge.
 */
export const BRANDING_DEFAULTS: Readonly<Record<string, string>> = {
  '--focus-ring': '#eeeede',

  '--base-bg': '#0a0812',
  '--base-border': '#8a7bd0',
  '--base-input-bg': '#1a1438',
  '--base-text': '#eeeede',
  '--base-alt-text': '#bcb2dc',
  '--base-subtle-text': '#b8aed8',
  '--base-highlight': '#ff9170',
  '--base-highlight-fg': '#2a0d05',
  '--base-highlight-hover': '#ffb199',

  '--mount-bg': 'rgba(255, 255, 255, 0.05)',
  '--mount-border': '#8a7bd0',
  '--mount-input-bg': '#1a1438',
  '--mount-text': '#eeeede',
  '--mount-alt-text': '#c4bce4',
  '--mount-highlight': '#ff9170',
  '--mount-highlight-fg': '#2a0d05',
  '--mount-highlight-hover': '#ffb199',

  '--orbit-bg': '#2a2550',
  '--orbit-border': '#8a7bd0',
  '--orbit-text': '#eeeede',
  '--orbit-alt-text': '#c4bce4',
  '--orbit-highlight': '#ff9170',
  '--orbit-highlight-fg': '#2a0d05',
  '--orbit-highlight-hover': '#ffb199',

  '--alert-bg': 'rgb(76 5 25 / 0.55)',
  '--alert-border': '#f87171',
  '--alert-text': '#fca5a5',
  '--alert-alt-text': '#fecaca',
  '--alert-highlight': '#f43f5e',
  '--alert-highlight-fg': '#2a0810',
  '--alert-highlight-hover': '#fb7185',

  '--warn-bg': 'rgb(69 26 3 / 0.55)',
  '--warn-border': '#f59e0b',
  '--warn-text': '#fcd34d',
  '--warn-alt-text': '#fde68a',
  '--warn-highlight': '#f59e0b',
  '--warn-highlight-fg': '#3a1a05',
  '--warn-highlight-hover': '#fbbf24',

  '--info-bg': 'rgb(23 37 84 / 0.55)',
  '--info-border': '#60a5fa',
  '--info-text': '#93c5fd',
  '--info-alt-text': '#bfdbfe',
  '--info-highlight': '#60a5fa',
  '--info-highlight-fg': '#0a1f3a',
  '--info-highlight-hover': '#93c5fd',

  '--success-bg': 'rgb(6 50 32 / 0.55)',
  '--success-border': '#22c55e',
  '--success-text': '#86efac',
  '--success-alt-text': '#bbf7d0',
  '--success-highlight': '#22c55e',
  '--success-highlight-fg': '#001a10',
  '--success-highlight-hover': '#34d399',
};

/**
 * The Custom theme's LIGHT starting palette: a light-mode counterpart to
 * `BRANDING_DEFAULTS`, in the same warm coral/peach + navy-violet identity but
 * inverted for a light surface (light backgrounds, dark text). The off-book
 * `branding` theme is dark-locked and is NEVER rendered in light mode in the
 * app — this palette exists ONLY so a fresh Custom theme's light mode "defaults
 * to branding" too, rather than falling through to the synthetic bundle
 * defaults.
 *
 * Because branding.css has no light cascade, there is no CSS source to drift
 * against; instead `brandingLightDefaults.contrast.test.ts` runs the real
 * bundle contrast + CVD-distinguishability math (via bundles-color-utils) over
 * these values, mechanizing the same WCAG-AA contract the .css themes satisfy.
 * All backgrounds are solid hex (no alpha) so they read as authored. As with
 * the dark map, every value is injected only through the `CUSTOM_TOKEN_KEYS`
 * allowlist, so this is not a trusted bypass.
 *
 * Load-bearing CVD constraint (do not casually retune): alert/success survives
 * deuteranopia purely on border luminance (rose `--alert-border` vs the
 * deliberately-dark `--success-border #1a7a44`). Keep alert-border dark and do
 * not darken success-border past #1a7a44, or that pair collapses both axes.
 */
export const BRANDING_DEFAULTS_LIGHT: Readonly<Record<string, string>> = {
  '--focus-ring': '#7a3a1f',

  '--base-bg': '#fdf8f3',
  '--base-border': '#5f4fa0',
  '--base-input-bg': '#ffffff',
  '--base-text': '#241a30',
  '--base-alt-text': '#4a3d66',
  '--base-subtle-text': '#5a4d74',
  '--base-highlight': '#b34418',
  '--base-highlight-fg': '#fff5f0',
  '--base-highlight-hover': '#8f3411',

  '--mount-bg': '#f4ecff',
  '--mount-border': '#5f4fa0',
  '--mount-input-bg': '#ffffff',
  '--mount-text': '#241a30',
  '--mount-alt-text': '#473a64',
  '--mount-highlight': '#b34418',
  '--mount-highlight-fg': '#fff5f0',
  '--mount-highlight-hover': '#8f3411',

  '--orbit-bg': '#e9e0fb',
  '--orbit-border': '#5f4fa0',
  '--orbit-text': '#241a30',
  '--orbit-alt-text': '#42355f',
  '--orbit-highlight': '#b34418',
  '--orbit-highlight-fg': '#fff5f0',
  '--orbit-highlight-hover': '#8f3411',

  '--alert-bg': '#fdeef0',
  '--alert-border': '#a82038',
  '--alert-text': '#a01228',
  '--alert-alt-text': '#7e0e20',
  '--alert-highlight': '#be123c',
  '--alert-highlight-fg': '#fff0f3',
  '--alert-highlight-hover': '#9f0f33',

  '--warn-bg': '#fff5e0',
  '--warn-border': '#b07b00',
  '--warn-text': '#7a5400',
  '--warn-alt-text': '#5f4200',
  '--warn-highlight': '#8a5e00',
  '--warn-highlight-fg': '#fff8ec',
  '--warn-highlight-hover': '#7f5600',

  '--info-bg': '#e8f1ff',
  '--info-border': '#2563c4',
  '--info-text': '#1851a8',
  '--info-alt-text': '#0f3e82',
  '--info-highlight': '#1d62c9',
  '--info-highlight-fg': '#f0f6ff',
  '--info-highlight-hover': '#164ea3',

  '--success-bg': '#e6f7ed',
  '--success-border': '#1a7a44',
  '--success-text': '#0f6b39',
  '--success-alt-text': '#0a522b',
  '--success-highlight': '#15803d',
  '--success-highlight-fg': '#f0fdf4',
  '--success-highlight-hover': '#0f6330',
};
