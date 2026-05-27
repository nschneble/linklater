/**
 * Scrolls a Settings section into view and moves focus to it. Shared by the
 * hash-driven scroll effect in `SettingsView` and the in-page nav click
 * handlers so every entry point uses the same positioning logic (which
 * honors each section's `scroll-mt-24`) and the same focus behavior.
 *
 * Returns true when the element was found and scrolled, false otherwise.
 */
export function scrollToSettingsSection(hash: string): boolean {
  if (!hash) return false;
  const element = document.getElementById(hash);
  if (!element) return false;
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
  element.focus({ preventScroll: true });
  return true;
}

/**
 * True when a click on an in-page anchor should be intercepted by SPA
 * routing. Left-button only, no modifier keys, and not already prevented
 * by another handler. Modified clicks fall through so "open in new tab",
 * copy-link, and middle-click keep working natively.
 */
export function isPlainAnchorClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}
