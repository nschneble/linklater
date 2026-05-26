import { useEffect, useState } from 'react';

/**
 * Returns `true` when the user has requested reduced motion via the OS-level
 * preference. Subscribes to media-query changes so toggling the preference at
 * runtime updates the value without a refresh.
 *
 * Use to gate animation-heavy interactions like `scrollIntoView({ behavior:
 * 'smooth' })` — Tailwind's `motion-safe:`/`motion-reduce:` variants only
 * style CSS and cannot affect JS calls.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reducedMotion;
}
