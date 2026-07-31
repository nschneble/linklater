/*
 * Asemic Old Turkic glyph runs (Unicode block U+10C00–U+10C48) that stand in
 * for the decorative app mock's visible copy. They carry NO meaning: the exact
 * code points are irrelevant, only their rough length mirrors the original
 * Latin so the mock still "reads" as a UI layout. Rendered in the self-hosted
 * "Noto Sans Old Turkic" webfont (scoped to the aria-hidden mock subtree alone),
 * the preview reads as asemic decoration that discourages interaction — it is a
 * picture of the app, never the app.
 *
 * Exported as named constants (never inline literals) so the mock's components
 * AND its tests share one source of truth, without either hard-coding raw
 * astral-plane string literals.
 */

// subset covers the Orkhon + Yenisei letters U+10C00-U+10C48
const GLYPH_RANGE_START = 0x10c00;
const GLYPH_RANGE_SIZE = 0x49;

/**
 * A deterministic (seeded) run of `length` glyphs. Deterministic so the mock
 * paints the same shapes on every render and the constants stay snapshot-stable
 * for tests — a linear congruential walk over the assigned range.
 */
function asemicWord(length: number, seed: number): string {
  const codePoints: number[] = [];
  let state = (seed * 2654435761) & 0x7fffffff;
  for (let position = 0; position < length; position += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    codePoints.push(GLYPH_RANGE_START + (state % GLYPH_RANGE_SIZE));
  }
  return String.fromCodePoint(...codePoints);
}

/**
 * Joins seeded words with a single ASCII space so a multi-word line keeps its
 * original word-boundary shape. The space falls outside the webfont's
 * unicode-range, so it renders from the Latin fallback — exactly as wanted.
 */
function asemicLine(wordLengths: number[], seed: number): string {
  return wordLengths
    .map((length, index) => asemicWord(length, seed + index + 1))
    .join(' ');
}

/**
 * The asemic stand-ins for the mock's static copy, keyed by what each replaces.
 * `yourLinks` is shared by the toolbar title and the account-menu row, mirroring
 * the real app's duplicate label.
 */
export const MOCK_GLYPHS = {
  // MockHeader (orbit)
  wordmark: asemicWord(7, 1),
  tagline: asemicLine([4, 5, 3, 4, 4, 5], 2),
  avatarInitial: asemicWord(1, 3),

  // MockToolbar (base)
  yourLinks: asemicLine([4, 5], 4),
  searchPlaceholder: asemicLine([6, 5], 5),
  addLink: asemicLine([3, 4], 7),
  stumble: asemicWord(7, 8),
  unread: asemicWord(6, 9),
  read: asemicWord(4, 10),

  // MockLinkCard (mount)
  linkTitle: asemicLine([8, 3, 3, 4, 7, 5], 11),
  linkDomain: asemicWord(15, 12),
  linkBody: asemicLine([1, 8, 4, 2, 8, 9, 4, 5, 4, 3, 7, 3, 5, 6, 11], 13),

  // MockMenu (orbit)
  loggedInAs: asemicLine([6, 2, 2], 14),
  accountEmail: asemicLine([4, 3], 15),
  settings: asemicWord(8, 16),
  toggleMode: asemicLine([6, 2, 4, 4], 17),
  editTheme: asemicLine([4, 4, 5], 18),
  logOut: asemicLine([3, 3], 19),
  // themeLabel + themeName mirror ThemeSubmenu's two-line trigger
  themeLabel: asemicWord(5, 30),
  themeName: asemicWord(8, 31),
} as const;

/**
 * The status-notice copy for the mock's alert/warn/info/success previews,
 * asemic like the rest of the mock. Keyed by status bundle, each with a longer
 * `banner` line (the centered inline-alert copy) and a shorter `toast` line
 * (the pill copy) so each notice keeps the shape of the two real status forms
 * MockNotice renders — an inline `Alert` banner above a `Toast` pill. Feeds
 * MockNotice's `banner`/`toast` props (MockNotice renders them verbatim).
 */
export const MOCK_STATUS_GLYPHS = {
  base: {
    banner: asemicLine([6, 7, 4, 5], 40),
    toast: asemicLine([4, 5], 41),
  },
  mount: {
    banner: asemicLine([6, 7, 4, 5], 40),
    toast: asemicLine([4, 5], 41),
  },
  orbit: {
    banner: asemicLine([6, 7, 4, 5], 40),
    toast: asemicLine([4, 5], 41),
  },
  warn: {
    banner: asemicLine([4, 5, 3, 4], 20),
    toast: asemicLine([4, 8, 3, 4, 2], 21),
  },
  info: {
    banner: asemicLine([3, 4, 1, 4, 2, 2], 22),
    toast: asemicLine([4, 5, 6, 6], 23),
  },
  alert: {
    banner: asemicLine([2, 8, 4, 4], 24),
    toast: asemicLine([3, 4, 3, 2, 5, 2, 1], 25),
  },
  success: {
    banner: asemicLine([4, 6], 26),
    toast: asemicLine([5, 2, 6, 3, 6], 27),
  },
} as const;
