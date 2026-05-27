interface ScrollOptions {
  /**
   * Skip the smooth-scroll animation and snap instantly. Used by the
   * re-anchor pass when async content extends the page after the initial
   * scroll — stacking smooth scrolls visibly fights itself.
   */
  instant?: boolean;
  /**
   * Skip moving focus to the section. Used by the re-anchor pass: the
   * initial scroll already moved focus, and re-grabbing it would yank a
   * user who has since tabbed elsewhere back out of their flow.
   */
  skipFocus?: boolean;
}

/**
 * Scrolls a Settings section into view and moves focus to it. Shared by the
 * hash-driven scroll effect in `SettingsView` and the in-page nav click
 * handlers so every entry point uses the same positioning logic (which
 * honors each section's `scroll-mt-24`) and the same focus behavior.
 *
 * Returns true when the element was found and scrolled, false otherwise.
 */
export function scrollToSettingsSection(
  hash: string,
  options: ScrollOptions = {},
): boolean {
  if (!hash) return false;
  const element = document.getElementById(hash);
  if (!element) return false;
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({
    behavior: options.instant || reducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
  // `focusVisible: true` forces the `:focus-visible` ring even when the
  // call originates inside a mouse-click handler (e.g. sidebar nav). Without
  // it, browsers' input-modality heuristic suppresses the ring on click-
  // driven focus and the sidebar entry point silently diverges from
  // deep-link / URL-hash entry. Unknown FocusOptions members are ignored
  // silently, so the worst case in browsers without support is the prior
  // behavior (ring on URL hash only). Cast is needed until lib.dom catches up.
  if (!options.skipFocus) {
    element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  }
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
