import IconButton from '../../common/IconButton';
import { useState } from 'react';
import type { Ref } from 'react';

interface RandomizeButtonProps {
  /** Generates + applies a fresh WCAG-AA palette for the current mode. */
  onRandomize: () => void;
  /**
   * Forwarded to the underlying `<button>` so the editor can move focus here
   * after a copy-initiated engage (no Undo to land on) or a copy-over Undo.
   * Randomize is the always-present recovery target (a11y brief R-B4/R-B5).
   */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * "Randomize": a global Colors-region action that fills the current mode's
 * palette with a freshly generated, WCAG-AA-passing set of colors (PRD point
 * 11). Randomizing is ALSO a way to go custom: like editing a color or copying
 * a theme, it seeds + saves the custom palette when custom is off.
 *
 * It is the shared elevated `IconButton` (the same control the "Your links"
 * toolbar uses for Stumble: `variant="elevated" surface="base"`), so it reads
 * as ordinary app chrome and degrades with the active theme exactly like the
 * rest of the chrome. It is a real `<button>` with VISIBLE text as its
 * accessible name; the die icon is decorative (`aria-hidden`).
 *
 * Delight (PRD point 12, the editor's "Stumble for colors"): the die ROLLS on
 * each activation, echoing Stumble's fa-spin energy. The roll is a one-shot CSS
 * animation (`animate-dice-roll`) replayed by remounting the icon via a
 * `spinNonce` key, never a JS animation loop, so it inherits the global
 * prefers-reduced-motion clamp. It is purely decorative feedback layered on top
 * of the existing live-region announce + visible palette repaint, so non-visual
 * and reduced-motion users lose nothing. Activation fires for mouse click AND
 * keyboard Enter/Space (native `<button>` onClick), so the roll is identical for
 * every input method. The die stays `aria-hidden` (it carries no semantics).
 */
export default function RandomizeButton({
  onRandomize,
  ref,
}: RandomizeButtonProps) {
  const [spinNonce, setSpinNonce] = useState(0);

  function handleClick() {
    setSpinNonce((current) => current + 1);
    onRandomize();
  }

  return (
    <IconButton
      ref={ref}
      variant="elevated"
      surface="base"
      onClick={handleClick}
    >
      <i
        key={spinNonce}
        data-testid="randomize-die"
        className={`fa-solid fa-dice ${spinNonce > 0 ? 'animate-dice-roll' : ''}`}
        aria-hidden="true"
      />
      Randomize
    </IconButton>
  );
}
