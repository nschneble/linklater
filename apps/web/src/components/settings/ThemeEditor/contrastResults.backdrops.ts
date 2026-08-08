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
 * For the chrome bundles it happens to be: a primary button sits on the card
 * that owns it. For the state bundles it is not, and the difference is the
 * most prominent use those tokens have. A toast paints `--{bundle}-highlight`
 * as its own background, `position: fixed` over the page, with no
 * `--{bundle}-bg` anywhere beneath it; a danger-filled icon button paints
 * `--alert-highlight` on whatever host it was dropped into.
 *
 * The editor's own mock counts as a render site, but only for the bundle it is
 * showing. `MockToast` paints every bundle's highlight over the mock's
 * `--base-bg`, and unlike its sibling mocks it never un-mutes: base, mount and
 * orbit stay grayscaled at 30% there, so those three are not rendering their
 * highlight color and `--base-bg` is not one of their hosts. For a status
 * bundle the pill is live, which is `info`'s only fill site anywhere.
 */
export const HIGHLIGHT_BACKDROPS: Record<
  Bundle,
  readonly (readonly string[])[]
> = {
  base: [['--base-bg']],
  mount: [['--mount-bg', '--base-bg']],
  orbit: [
    ['--orbit-bg', '--base-bg'],
    ['--orbit-bg', '--mount-bg', '--base-bg'],
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
