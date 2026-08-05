import { BUNDLES, type Bundle } from './useThemeOverrides';

/**
 * Where each bundle's surface actually renders, nearest backdrop first.
 *
 * Derived from walking every `bg-[var(--{bundle}-bg)]` consumer up its tree,
 * not from the token names. Two things fall out of that walk which the naming
 * does not suggest: `info` only ever renders inside a mount card, never
 * directly on the page, and `alert` can sit on another alert (the danger-zone
 * SettingsGroup paints `--alert-bg`, and confirm flows nest an Alert inside
 * it). Depth 3 is the observed maximum, so this is a literal table rather
 * than a general resolver.
 *
 * A surface with several hosts is evaluated against ALL of them and scored on
 * the WORST result. WCAG conformance is per-instance: if one rendered
 * instance fails, that instance fails, and averaging would hide it.
 */
const BUNDLE_BACKDROPS: Record<Bundle, readonly (readonly string[])[]> = {
  base: [[]],
  mount: [['--base-bg']],
  orbit: [['--base-bg'], ['--mount-bg', '--base-bg']],
  warn: [['--base-bg'], ['--mount-bg', '--base-bg']],
  info: [['--mount-bg', '--base-bg']],
  alert: [
    ['--base-bg'],
    ['--mount-bg', '--base-bg'],
    ['--orbit-bg', '--base-bg'],
    ['--alert-bg', '--mount-bg', '--base-bg'],
  ],
  success: [
    ['--base-bg'],
    ['--mount-bg', '--base-bg'],
    ['--orbit-bg', '--base-bg'],
    ['--alert-bg', '--mount-bg', '--base-bg'],
  ],
};

/** The bundle a `--{bundle}-{slot}` token belongs to, or null. */
function bundleOf(token: string): Bundle | null {
  return BUNDLES.find((bundle) => token.startsWith(`--${bundle}-`)) ?? null;
}

/**
 * The candidate backdrop chains for a background token.
 *
 * A bundle's own `-bg` sits directly on its host chain. Anything else painted
 * within that bundle (a highlight, an input) sits on the bundle's background
 * first, and only then on the host chain.
 */
export function chainsFor(
  backgroundToken: string,
): readonly (readonly string[])[] {
  const bundle = bundleOf(backgroundToken);
  if (bundle === null) return [[]];
  const hostChains = BUNDLE_BACKDROPS[bundle];
  if (backgroundToken === `--${bundle}-bg`) return hostChains;
  return hostChains.map((chain) => [`--${bundle}-bg`, ...chain]);
}
