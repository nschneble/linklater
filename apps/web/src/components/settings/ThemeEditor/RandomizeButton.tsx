import { EDITOR_FOCUS_RING, ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';

interface RandomizeButtonProps {
  /** Generates + applies a fresh WCAG-AA palette for the current mode. */
  onRandomize: () => void;
}

/**
 * "Randomize" — a global Colors-region action that fills the current mode's
 * palette with a freshly generated, WCAG-AA-passing set of colors (PRD point
 * 11). Randomizing is ALSO a way to go custom: like editing a color or copying
 * a theme, it seeds + saves the custom palette when custom is off.
 *
 * It paints from the FIXED escape-hatch colors (not bundle tokens) and uses the
 * fixed-blue `EDITOR_FOCUS_RING`, exactly like the copy-menu trigger and Undo:
 * it is an always-operable recovery-class control, so it must stay legible AND
 * keyboard-focusable even on top of a hostile generated palette (a generated
 * palette is always readable, but a PRIOR hostile hand-edit could still be live
 * when the user reaches for this). It is a real `<button>` with VISIBLE text as
 * its accessible name; the die icon is decorative (`aria-hidden`).
 */
export default function RandomizeButton({ onRandomize }: RandomizeButtonProps) {
  return (
    <button
      type="button"
      onClick={onRandomize}
      style={ESCAPE_HATCH_LIGHT}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-semibold ${EDITOR_FOCUS_RING} rounded-lg active:scale-[0.96] transition-transform cursor-pointer`}
    >
      <i className="fa-solid fa-dice" aria-hidden="true" />
      Randomize
    </button>
  );
}
