import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../../lib/hooks/useReducedMotion';

/**
 * How long the exit animation is given to play before the panel unmounts.
 * Covers the staggered `animate-fade-out-down` cards (last card starts ~120ms
 * in, the keyframe runs 150ms), with a little slack.
 */
const EXIT_DURATION_MS = 220;

export interface PanelPresence {
  /** Whether to render the panel at all (stays true through the exit window). */
  rendered: boolean;
  /** True while the panel is mounted but animating out (swap enter→exit class). */
  exiting: boolean;
}

/**
 * Keeps a panel mounted through its exit animation so it can fade out instead
 * of vanishing. While `active` the panel renders and plays its enter animation;
 * when `active` flips false the panel stays mounted for one `animate-fade-out-down`
 * cycle (`exiting` true) and then unmounts. Mirrors the link-card enter/exit
 * approach and the Toast unmount-after-animation precedent.
 *
 * Reduced-motion users unmount synchronously (no lingering invisible frame) —
 * the global `prefers-reduced-motion` CSS clamps the animation to ~instant, so
 * waiting would only leave an opacity-0 panel in the tree for no benefit.
 */
export function usePanelPresence(active: boolean): PanelPresence {
  const reducedMotion = useReducedMotion();
  const [rendered, setRendered] = useState(active);

  useEffect(() => {
    if (active) {
      setRendered(true);
      return;
    }
    if (!rendered) return;
    if (reducedMotion) {
      setRendered(false);
      return;
    }
    const timer = window.setTimeout(() => setRendered(false), EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, rendered, reducedMotion]);

  return { rendered, exiting: rendered && !active };
}
