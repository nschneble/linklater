import BundleTabs from './BundleTabs';
import { useId } from 'react';
import type { Bundle } from './useThemeOverrides';
import type { TokenContrastFailure } from './contrastResults';
import type { ThemeVariable } from './useThemeOverrides';

interface ColorEditorProps {
  /** The current (possibly overridden) values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Worst failing pair keyed by EITHER endpoint (`pairsTouchingToken`), read by
   * the per-bundle slot rows — so a failure self-reports on whichever slot
   * (foreground OR background) was edited (C3).
   */
  failures: Map<string, TokenContrastFailure>;
  /**
   * Label of the theme the swatches are seeded from while the custom theme is
   * not yet active. Drives the region-level "These start from {theme}…" note
   * (a11y brief §5).
   */
  baseThemeLabel: string;
  /**
   * Whether the custom theme is already active. While `false` the swatches are
   * a live mirror of `baseThemeLabel`, so the editor discloses that editing one
   * commits it as the user's own theme (SC 3.3.2).
   */
  customActive: boolean;
  /** Called when the user changes a single slot's color. */
  onOverride: (variable: ThemeVariable, value: string) => void;
  /**
   * The bundle whose slots are shown + edited. Lifted to the editor root so the
   * live preview can mirror the SAME selection the tablist drives (PRD point 4).
   */
  activeBundle: Bundle;
  /** Selects which bundle's slots are shown + edited (also repaints the preview). */
  onActiveBundleChange: (bundle: Bundle) => void;
}

/**
 * The Colors editing region: a bundle tablist driving a single panel of the
 * chosen bundle's raw slots, in the editor's current mode. The full ~49-token
 * list and the five human knobs are both retired — users pick a bundle, then
 * edit only its 7-10 slots (PRD point 3). The Light/Dark palette toggle that
 * chooses the mode now lives in the header toolbar (a sibling above this
 * region), not here.
 *
 * This is a NAMED region (`<section aria-labelledby>` on the "Color Bundles" h2)
 * so AT still announces it after the old `SettingsGroup` card was dropped (a11y
 * brief §3). The region holds two headings — the "Color Bundles" h2 (also the
 * tablist's `aria-labelledby` target) and a "Colors" h3 rendered inside
 * `BundleTabs` between the tablist and the slot panel — so the outline runs
 * h1 → h2 → h3 with no skipped level. The bundle tabs themselves are NOT headings
 * (the tab role self-voices).
 */
export default function ColorEditor({
  colorValues,
  failures,
  baseThemeLabel,
  customActive,
  onOverride,
  activeBundle,
  onActiveBundleChange,
}: ColorEditorProps) {
  const colorBundlesHeadingId = useId();

  return (
    <section aria-labelledby={colorBundlesHeadingId} className="space-y-3">
      <h2
        id={colorBundlesHeadingId}
        className="text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold"
      >
        Color Bundles
      </h2>

      {/* Pre-custom disclosure (SC 3.3.2): until the user goes custom these
          swatches mirror the active theme, so editing one commits the palette
          as their own. Named at the REGION level so the theme name stays out
          of every per-slot label. Drops away once custom is active. */}
      {!customActive && (
        <p role="note" className="text-[var(--mount-alt-text)] text-[0.7rem]">
          These start from {baseThemeLabel}. Editing any color saves it as your
          own theme.
        </p>
      )}

      <BundleTabs
        colorValues={colorValues}
        contrastFailures={failures}
        activeBundle={activeBundle}
        onBundleChange={onActiveBundleChange}
        onOverride={onOverride}
        tablistLabelledBy={colorBundlesHeadingId}
      />
    </section>
  );
}
