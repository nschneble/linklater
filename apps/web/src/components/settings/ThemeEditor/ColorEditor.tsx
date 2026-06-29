import BundleTabs from './BundleTabs';
import ModeToggle from './ModeToggle';
import { BUNDLES, type Bundle } from './useThemeOverrides';
import { useId, useState } from 'react';
import type { Mode } from '../../../theme/constants';
import type { ThemeVariable } from './useThemeOverrides';
import type { TokenContrastFailure } from './contrastResults';

const EDITOR_MODE_LABELS: Record<Mode, string> = {
  light: 'Light colors',
  dark: 'Dark colors',
};

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
   * The editor's LOCAL color mode (which mode's palette is shown + edited). The
   * Light/Dark toggle at the top of the region drives this; it is decoupled
   * from the global site mode.
   */
  editorMode: Mode;
  /** Switches which mode's palette the editor shows + edits. */
  onEditorModeChange: (mode: Mode) => void;
}

/**
 * The Colors editing region: a Light/Dark mode toggle + a bundle tablist that
 * together drive a single panel of the chosen bundle's raw slots, in the chosen
 * mode. The full ~49-token list and the five human knobs are both retired —
 * users pick a bundle, then edit only its 7-10 slots (PRD point 3).
 *
 * This is a NAMED region (`<section aria-labelledby>` on the "Colors" h2) so AT
 * still announces it after the old `SettingsGroup` card was dropped (a11y brief
 * §3). The h2 is the only heading inside; the bundle tabs are NOT headings (the
 * tab role self-voices), so the outline stays h1 → h2 with no skipped level.
 */
export default function ColorEditor({
  colorValues,
  failures,
  baseThemeLabel,
  customActive,
  onOverride,
  editorMode,
  onEditorModeChange,
}: ColorEditorProps) {
  const colorsHeadingId = useId();
  const [activeBundle, setActiveBundle] = useState<Bundle>(BUNDLES[0]);

  return (
    <section aria-labelledby={colorsHeadingId} className="space-y-3">
      {/* Light/Dark palette selector — the FIRST control so DOM order matches
          the read flow ("choose a mode, then a bundle, then edit"). It repoints
          this region + the Components preview to that mode's palette WITHOUT
          touching the global site mode (a binary toggle, not a tablist: there is
          no single panel to own). The group label names the consequence so the
          pressed state self-documents — no live region. */}
      <ModeToggle
        mode={editorMode}
        onModeChange={onEditorModeChange}
        groupLabel="Palette to edit"
        labels={EDITOR_MODE_LABELS}
      />

      <h2
        id={colorsHeadingId}
        className="text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold"
      >
        Colors
      </h2>

      {/* Pre-custom disclosure (SC 3.3.2): until the user has gone custom these
          swatches are a live mirror of the active theme, so editing one is what
          commits the palette as their own. Named at the REGION level — the theme
          name stays out of every per-slot label (a11y brief §5). Drops away once
          custom is active, when "start from {theme}" is no longer true. */}
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
        onBundleChange={setActiveBundle}
        onOverride={onOverride}
      />
    </section>
  );
}
