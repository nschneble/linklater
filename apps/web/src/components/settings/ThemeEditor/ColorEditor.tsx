import KnobPanel from './KnobPanel';
import ModeToggle from './ModeToggle';
import TokenTree, { TOKEN_TREE_ID } from './TokenTree';
import { ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';
import { useState } from 'react';
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
   * BOTH the knobs AND the demoted token-tree rows — so a failure self-reports
   * on whichever control (knob or drawer row) was edited, including when the
   * edited token is the pair's BACKGROUND (C3).
   */
  failures: Map<string, TokenContrastFailure>;
  /**
   * Count of failing pairs with no knob endpoint ("drawer-only"). Drives the
   * count badge + accessible name on the "Show all colors" toggle so failures
   * buried in the collapsed drawer are still discoverable (GAP2).
   */
  drawerOnlyFailureCount: number;
  /**
   * Label of the theme the swatches are seeded from while the custom theme is
   * not yet active. Drives the region-level "These start from {theme}…"
   * disclosure (a11y brief §5).
   */
  baseThemeLabel: string;
  /**
   * Whether the custom theme is already active. While `false` the swatches are
   * a live mirror of `baseThemeLabel`, so the editor discloses that editing one
   * commits it as the user's own theme (SC 3.3.2).
   */
  customActive: boolean;
  /** Called when the user changes a single drawer token. */
  onOverride: (variable: ThemeVariable, value: string) => void;
  /** Called when a knob flattens several tokens to one value at once. */
  onKnobOverride: (variables: ThemeVariable[], value: string) => void;
  /**
   * The editor's LOCAL color mode (which mode's palette is shown + edited). The
   * Light/Dark tabs at the top of the card drive this; it is decoupled from the
   * global site mode.
   */
  editorMode: Mode;
  /** Switches which mode's palette the editor shows + edits. */
  onEditorModeChange: (mode: Mode) => void;
}

/**
 * Orchestrates the Colors card: the Light/Dark palette tabs, the five human
 * knobs, and the "show all colors" drawer holding the full token tree.
 *
 * The knobs cover the ~5 decisions most people want (Page, Cards, Accent, Text,
 * Alerts); the drawer holds every remaining token for power users. The drawer's
 * open state lives HERE (the orchestrator) and the tree is mounted ALWAYS,
 * toggled via the HTML `hidden` attribute — unmounting would dangle the toggle's
 * `aria-controls`, strand focus, and lose the search/open-set state. The toggle
 * keeps focus on itself across expand/collapse (no auto-focus into the tree).
 */
export default function ColorEditor({
  colorValues,
  failures,
  drawerOnlyFailureCount,
  baseThemeLabel,
  customActive,
  onOverride,
  onKnobOverride,
  editorMode,
  onEditorModeChange,
}: ColorEditorProps) {
  const [showAll, setShowAll] = useState(false);

  // The drawer is collapsed by default, so failures whose neither endpoint is
  // a knob would be invisible until opened. The toggle advertises them: the
  // visible label drives the accessible name when there are none; when there
  // are, an aria-label that STARTS WITH the visible label (SC 2.5.3) folds the
  // count in, and a fixed-color badge reinforces it sightedly. The drawer is
  // NOT auto-expanded (that would fight the persisted open-set + surprise the
  // user, SC 3.2.x).
  const toggleLabel = showAll ? 'Hide all colors' : 'Show all colors';
  const toggleAccessibleName =
    drawerOnlyFailureCount > 0
      ? `${toggleLabel} — ${drawerOnlyFailureCount} with contrast ${drawerOnlyFailureCount === 1 ? 'issue' : 'issues'}`
      : undefined;

  return (
    <div className="space-y-3">
      {/* Light/Dark palette selector — the FIRST control in the card so DOM
          order matches the read flow ("choose a mode, then edit"). It re-points
          this card + the Contrast and Components cards to that mode's palette
          WITHOUT touching the global site mode (a binary toggle, not a tablist:
          there is no single panel to own). The group label names the
          consequence so the pressed state self-documents — no live region. */}
      <ModeToggle
        mode={editorMode}
        onModeChange={onEditorModeChange}
        groupLabel="Palette to edit"
        labels={EDITOR_MODE_LABELS}
      />

      <h2 className="text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
        Colors
      </h2>

      {/* Pre-custom disclosure (SC 3.3.2): until the user has gone custom these
          swatches are a live mirror of the active theme, so editing one is what
          commits the palette as their own. Named at the REGION level — the
          theme name stays out of every per-swatch label (a11y brief §5). Drops
          away once custom is active, when "start from {theme}" is no longer
          true. */}
      {!customActive && (
        <p role="note" className="text-[var(--mount-alt-text)] text-[0.7rem]">
          These start from {baseThemeLabel}. Editing any color saves it as your
          own theme.
        </p>
      )}

      <KnobPanel
        colorValues={colorValues}
        knobFailures={failures}
        onKnobOverride={onKnobOverride}
      />

      {/* Plain disclosure button (NOT a heading) — the per-bundle disclosures
          inside the tree keep their h3s, so promoting this would break the
          outline. Mount+hidden (below) keeps `aria-controls` resolved even
          while collapsed. */}
      <button
        type="button"
        aria-expanded={showAll}
        aria-controls={TOKEN_TREE_ID}
        aria-label={toggleAccessibleName}
        onClick={() => setShowAll((previous) => !previous)}
        className="group flex items-center gap-2 text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] text-[0.7rem] font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
      >
        <i
          className="fa-solid fa-chevron-right text-[0.55rem] group-aria-expanded:rotate-90 transition-transform duration-150"
          aria-hidden="true"
        />
        {toggleLabel}
        {drawerOnlyFailureCount > 0 && (
          // Fixed-color escape-hatch badge: it lives inside the preview scope,
          // so a hostile palette could vanish a token-painted badge precisely
          // when it matters most. Meaning is in the aria-label above; the badge
          // (icon + count) is decorative reinforcement (aria-hidden).
          <span
            aria-hidden="true"
            style={{ ...ESCAPE_HATCH_LIGHT, color: '#92400e' }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 border text-[0.6rem] font-semibold rounded"
          >
            <i
              className="fa-solid fa-triangle-exclamation text-[0.55rem]"
              aria-hidden="true"
            />
            {drawerOnlyFailureCount}
          </span>
        )}
      </button>

      <TokenTree
        colorValues={colorValues}
        contrastFailures={failures}
        onOverride={onOverride}
        visible={showAll}
      />
    </div>
  );
}
