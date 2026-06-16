/**
 * Brand-themed Scalar overrides, injected via `customCss` and scoped to
 * `.scalar-app` so the rules stay page-local and don't leak into other
 * Scalar embeds. Layers on top of the dark-mode baseline declared globally
 * in `apps/web/src/index.css` (`:root .dark-mode { --scalar-color-1: ... }`)
 * — that baseline maps a handful of slots, this file extends it to cover
 * accent / link / border / button / focus / selection so the embed reads
 * as Linklater brand rather than Scalar's default dark.
 *
 * Hard rules enforced (verified by culori contrast math at plan time):
 *
 *   --scalar-color-1     dazed   on midnight  15.01:1   SC 1.4.3   PASS
 *   --scalar-color-2     dazed   on midnight  15.01:1   SC 1.4.3   PASS
 *                                on boyhood   11.55:1
 *   --scalar-color-3     confused on midnight  6.15:1   SC 1.4.3   PASS
 *                                 on boyhood   4.73:1
 *   --scalar-color-accent #ff9170 on midnight  7.99:1   SC 1.4.3   PASS
 *                                 on boyhood   6.15:1
 *   --scalar-border-color #7d6ec0 on midnight  4.07:1   SC 1.4.11  PASS
 *                                 on boyhood   3.14:1   (lifted)
 *   focus outline (dazed) on midnight 15.01:1, boyhood 11.55:1,
 *                         on sunrise   4.70:1            SC 1.4.11  PASS
 *   --scalar-button-1-color dazed on sunrise 4.70:1     SC 1.4.3   PASS
 *                                  on #a82e0c hover 5.85:1
 *
 * Notes on the accent variant: brand `sunrise` (#c03812) clears only 3.20:1
 * on midnight — fine for state borders (1.4.11) but failing for link text
 * (1.4.3). `#ff9170` is the same hue family lightened to clear 4.5:1 on
 * both bg-1 (midnight) and bg-2 (boyhood). Hue separation vs the default
 * Scalar `--scalar-color-orange` (kept untouched at #ff8d4d) is small but
 * the two slots never collocate in the rendered embed.
 *
 * Explicit non-overrides (per pre-build a11y-lead brief):
 *   - HTTP method colors (--scalar-color-{green,red,yellow,blue,orange,
 *     purple}) — re-tinting collapses CVD hue separation and breaks
 *     developer expectations; method-name TEXT carries 1.4.1.
 *   - Syntax highlighting code-block tokens — Scalar's defaults already
 *     pass 4.5:1 on its dark code bg.
 *   - Status colors (--scalar-color-alert, --scalar-color-danger) — kept
 *     standard so error banners stay legible to muscle memory.
 *   - Sidebar variables — config sets `showSidebar: false`, sidebar is
 *     never rendered, overrides would be dead code.
 *
 * Selector scoping: `.scalar-app .dark-mode, .scalar-app.dark-mode`
 * matches Scalar's own internal dark-mode class regardless of where it
 * lands in the tree, so these custom-property writes win the cascade over
 * `node_modules/@scalar/themes/dist/style.css :is(.dark-mode) { ... }`.
 *
 * `::selection` uses sunrise @ 35% alpha; composited over midnight it
 * still clears 4.5:1 with dazed selected text (11.04:1) per SC 1.4.3.
 */
const BRAND_CSS = `
.scalar-app .dark-mode,
.scalar-app.dark-mode {
  --scalar-color-1: #eeeede;
  --scalar-color-2: #eeeede;
  --scalar-color-3: #9b92c8;
  --scalar-background-1: #1a1530;
  --scalar-background-2: #2e2855;
  --scalar-background-3: #3a3470;
  --scalar-background-accent: rgba(192, 56, 18, 0.18);
  --scalar-color-accent: #ff9170;
  --scalar-border-color: #7d6ec0;
  --scalar-link-color: #ff9170;
  --scalar-link-color-hover: #eeeede;
  --scalar-button-1: #c03812;
  --scalar-button-1-hover: #a82e0c;
  --scalar-button-1-color: #eeeede;
}

.scalar-app *:focus-visible {
  outline: 2px solid #eeeede;
  outline-offset: 2px;
}

.scalar-app ::selection {
  background: rgba(192, 56, 18, 0.35);
  color: #eeeede;
}
`;

export default BRAND_CSS;
