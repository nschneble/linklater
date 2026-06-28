import { EDITOR_FOCUS_RING, ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';

const DESCRIPTION_ID = 'theme-editor-custom-description';

interface CustomThemeOffRampProps {
  /**
   * Whether the custom theme is currently active (editing + saving here, and
   * shown in the picker menus). Drives whether the "Back to …" off-ramp shows.
   */
  active: boolean;
  /** Label of the theme to return to (e.g. "School of Rock"). */
  baseThemeLabel: string;
  /** Reverts to the named theme, keeping the saved custom palette intact. */
  onRevert: () => void;
}

/**
 * The custom theme's off-ramp. There is no master switch: touching any color
 * IS the act of going custom (the first edit seeds + saves the palette). So the
 * only standing control here is the way BACK — a plain "Back to {theme}" button
 * that reverts the preview to the named theme without discarding the saved
 * palette. It renders only while the custom theme is active, paired with the
 * editor's polite "Your theme is on/off" announcement so the live state is never
 * signalled by this button's mere presence alone (a11y brief §1/§3).
 *
 * The button paints from the FIXED escape-hatch palette (#fafafa bg / #0a0a0a
 * text / #404040 border) and a fixed-blue focus ring, NEVER bundle tokens: when
 * the custom theme is the LIVE site theme its palette is injected onto `:root`,
 * so a hostile palette could otherwise make the one control needed to escape it
 * unreadable (SC 1.4.3 / 1.4.11). Same posture as the contrast chip + mode pill.
 */
export default function CustomThemeOffRamp({
  active,
  baseThemeLabel,
  onRevert,
}: CustomThemeOffRampProps) {
  return (
    <div>
      {active && (
        <button
          type="button"
          onClick={onRevert}
          style={ESCAPE_HATCH_LIGHT}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-semibold ${EDITOR_FOCUS_RING} rounded-lg cursor-pointer`}
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Back to {baseThemeLabel}
        </button>
      )}
      <p
        id={DESCRIPTION_ID}
        className={`max-w-prose ${active ? 'mt-1.5' : ''} text-[var(--mount-alt-text)] text-xs`}
      >
        {active
          ? `Editing any color saves it as your theme. “Back to ${baseThemeLabel}” returns to that theme — your colors are kept.`
          : `Editing any color here saves it as your own theme, shown in the picker alongside the built-in ones.`}
      </p>
    </div>
  );
}
