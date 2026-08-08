import { BUNDLES, type Bundle } from './useThemeOverrides';

/*
 * Where each bundle's surfaces actually render, nearest backdrop first.
 *
 * Every chain here was derived by opening each consumer that paints a
 * `--{bundle}-bg` background and walking its JSX ancestors to the first
 * painted one, never inferred from the token names. A literal Tailwind class
 * cannot be written in this prose: the build scans comments too and would
 * compile the example into a real, broken utility.
 * `contrastResults.backdrops.test.ts`
 * holds that derivation to account: it re-discovers the consumer set from
 * source, requires every chain to cite a file that paints each of its layers,
 * and fails on a chain nothing cites. Inference is what produced the wrong
 * table this replaced, so nothing here may be reasoned about from a name.
 *
 * A surface with several hosts is evaluated against ALL of them and scored on
 * the WORST result. WCAG conformance is per-instance: if one rendered
 * instance fails, that instance fails, and averaging would hide it. The flip
 * side is that a chain that does not exist promotes itself into the number the
 * user sees, which is why an uncited chain is a test failure.
 *
 * The longest chain has three backdrops, so four painted layers: an Alert
 * inside a PAT row inside a settings card inside the page.
 */
export const BUNDLE_BACKDROPS: Record<Bundle, readonly (readonly string[])[]> =
  {
    base: [[], ['--base-bg']],
    mount: [['--base-bg'], ['--mount-bg', '--base-bg']],
    orbit: [
      ['--base-bg'],
      ['--mount-bg', '--base-bg'],
      ['--orbit-bg', '--base-bg'],
    ],
    alert: [
      ['--base-bg'],
      ['--mount-bg', '--base-bg'],
      ['--alert-bg', '--base-bg'],
      ['--orbit-bg', '--mount-bg', '--base-bg'],
    ],
    warn: [['--base-bg'], ['--mount-bg', '--base-bg']],
    info: [['--base-bg'], ['--mount-bg', '--base-bg']],
    success: [
      ['--base-bg'],
      ['--mount-bg', '--base-bg'],
      ['--alert-bg', '--base-bg'],
    ],
  };

/*
 * Where each bundle's HIGHLIGHT fill renders. Separate from the table above
 * because a highlight is not a layer painted on its own bundle background.
 *
 * For the chrome bundles it OFTEN is: a primary button sits on the card that
 * owns it. Two things break that reading, and both were wrong here before.
 *
 * The first is the host. A button takes its fill from the bundle it was told
 * hosts it, which is not always the bundle of the card it landed in. The
 * account-deletion form is the case: its submit button asks for no host, so it
 * fills from the default chrome tier while sitting on the danger card, and the
 * pairing that produces is measured nowhere else.
 *
 * The second is same-element replacement. A control that swaps its own
 * background on a state variant does NOT layer the new fill over the old one:
 * the declaration that wins REPLACES the other, so the bundle background it
 * paints when idle is not a backdrop of the highlight it paints when on. The
 * settings switch reads that way, and its real backdrop is the card its
 * section renders in, not itself. Its component is correct as written, and the
 * project asks for exactly that pattern; this table is what had to change.
 *
 * For the state bundles the "sits on its own card" reading fails outright, and
 * the difference is the most prominent use those tokens have. A toast paints
 * its highlight as its own background, fixed over the page, with no bundle
 * background anywhere beneath it; a danger-filled icon button paints the alert
 * highlight on whatever host it was dropped into.
 *
 * The editor's own mock counts as a render site, but only for the bundle it is
 * showing. Nothing in that subtree carries a conformance obligation of
 * its own under SC 1.4.3: its controls are inert, everything it paints
 * is pure decoration, and its copy is asemic filler that is part of a
 * picture of an application rather than text anyone reads. Being hidden
 * from assistive technology sits alongside those rather than standing as
 * an exemption of its own, so it cannot carry the argument. The mock is
 * listed anyway because worst-of scoring can only ever be made stricter
 * by another site, never laxer. That is why leaving the muted bundles OUT of
 * the toast mock forfeits no claim. The reason they are out is that the toast
 * mock is the one mock that never un-mutes on hover, so for the three chrome
 * bundles it shows a desaturated swatch rather than their highlight color. Its
 * suite pins that, because the one-line hover un-mute a reviewer would ask for
 * is what makes the exclusion wrong. For a status bundle the pill is live,
 * which is the only fill site the info bundle has anywhere.
 */
export const HIGHLIGHT_BACKDROPS: Record<
  Bundle,
  readonly (readonly string[])[]
> = {
  base: [['--base-bg']],
  mount: [
    ['--mount-bg', '--base-bg'],
    ['--alert-bg', '--base-bg'],
  ],
  orbit: [
    ['--orbit-bg', '--base-bg'],
    ['--mount-bg', '--base-bg'],
  ],
  alert: [
    ['--base-bg'],
    ['--mount-bg', '--base-bg'],
    ['--alert-bg', '--base-bg'],
    ['--orbit-bg', '--mount-bg', '--base-bg'],
  ],
  warn: [['--base-bg']],
  info: [['--base-bg']],
  success: [['--base-bg']],
};

/** The bundle a `--{bundle}-{slot}` token belongs to, or null. */
function bundleOf(token: string): Bundle | null {
  return BUNDLES.find((bundle) => token.startsWith(`--${bundle}-`)) ?? null;
}

/**
 * The candidate backdrop chains for a background token.
 *
 * Only two token shapes ever reach here, because only two shapes are ever a
 * contract pair's BACKGROUND: a bundle's `-bg`, and its two highlight states.
 * Each reads its own table. Anything else gets the empty chain rather than a
 * guess, since guessing a host is what this module exists to stop.
 */
export function chainsFor(
  backgroundToken: string,
): readonly (readonly string[])[] {
  const bundle = bundleOf(backgroundToken);
  if (bundle === null) return [[]];
  if (backgroundToken === `--${bundle}-bg`) return BUNDLE_BACKDROPS[bundle];
  if (
    backgroundToken === `--${bundle}-highlight` ||
    backgroundToken === `--${bundle}-highlight-hover`
  ) {
    return HIGHLIGHT_BACKDROPS[bundle];
  }
  return [[]];
}
