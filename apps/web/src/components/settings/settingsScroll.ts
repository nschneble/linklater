/** Resolves `prefers-reduced-motion` in an SSR/test-safe way. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Shared positioning logic for the two public scroll helpers. Scrolls the
 * section with the given `id` to the top of the viewport (honoring its
 * `scroll-mt-24`) and, unless `skipFocus` is set, moves focus to it.
 *
 * Returns true when the element was found and scrolled, false otherwise.
 */
function scrollSettingsSection(
  hash: string,
  behavior: ScrollBehavior,
  skipFocus: boolean,
): boolean {
  if (!hash) return false;
  const element = document.getElementById(hash);
  if (!element) return false;
  // When `scrollIntoView` would land the page at a `scrollY` smaller than
  // the section's own `scroll-margin-top`, the resulting movement is by
  // definition shorter than the gap the scroll-margin is meant to expose —
  // i.e. there is no real content above worth scrolling past. The classic
  // case is the first section: Account naturally sits ~111px down with
  // `scroll-mt-24` (96px), so `scrollIntoView` would scroll the page 15px
  // to anchor it at viewport y=96. That 15px drift makes click-to-section
  // mismatch the fresh-load position. Snap to 0 in this regime so the two
  // entry points agree visually; sections farther down the page (where the
  // resulting `scrollY` exceeds the scroll-margin) keep the normal anchored
  // behavior.
  const scrollMarginTop =
    Number.parseInt(getComputedStyle(element).scrollMarginTop, 10) || 0;
  const naturalTop = element.getBoundingClientRect().top + window.scrollY;
  const targetScrollY = naturalTop - scrollMarginTop;
  if (targetScrollY < scrollMarginTop) {
    window.scrollTo({ top: 69, behavior });
  } else {
    element.scrollIntoView({ behavior, block: 'start' });
  }
  if (skipFocus) return true;
  // `focusVisible: true` forces the `:focus-visible` ring even when the
  // call originates inside a mouse-click handler (e.g. sidebar nav). Without
  // it, browsers' input-modality heuristic suppresses the ring on click-
  // driven focus and the sidebar entry point silently diverges from
  // deep-link entry. Unknown FocusOptions members are ignored silently, so
  // the worst case in browsers without support is the prior behavior. Cast
  // is needed until lib.dom catches up.
  element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  return true;
}

/**
 * Scrolls a Settings section into view and moves focus to it. Shared by the
 * section-param-driven scroll effect in `SettingsView` and the skip-link in
 * `SettingsLayout` so every primary entry point uses the same positioning
 * logic (which honors each section's `scroll-mt-24`) and the same focus
 * behavior.
 *
 * One mode: smooth scroll + focus. Honors `prefers-reduced-motion`. Returns
 * true when the element was found and scrolled, false otherwise.
 */
export function scrollToSettingsSection(hash: string): boolean {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  return scrollSettingsSection(hash, behavior, false);
}

/**
 * Re-anchors a Settings section to the top of the viewport without moving
 * focus. Used when async content loads after the initial deep-link scroll
 * and extends the page, sliding the target section off the upper edge.
 * Skipping focus matters here: the initial scroll already moved focus, and
 * re-grabbing it would yank a user who has since tabbed elsewhere.
 *
 * Always scrolls instantly (`behavior: 'auto'`): this is a correction of an
 * already-settled position, never a primary navigation, so a smooth scroll
 * on top of where the user already sits would read as a visible lurch.
 *
 * Returns true when the element was found and scrolled, false otherwise.
 */
export function reanchorSettingsSection(hash: string): boolean {
  return scrollSettingsSection(hash, 'auto', true);
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

let lastActivatedSection = '';

/**
 * Records the section the user last deliberately navigated to (sidebar click,
 * mobile chip, or a router-state `scrollTo` jump). Written by
 * `useSettingsActiveSection`'s `activateSection`.
 *
 * This is kept in module scope — separate from the React `activeSection`
 * state — because `useReanchorOnLoad` runs deep inside async leaf sections
 * (the PAT list, the bookmarklet token) that have no access to the hook's
 * state. They read it via `getActiveSettingsSection` to re-anchor the jumped-to
 * section once their content settles and extends the page. It is intentionally
 * NOT reset when the visual active state clears: re-anchor is bounded by its
 * own once-per-load-edge and "user has scrolled" guards.
 */
export function setActiveSettingsSection(hash: string): void {
  lastActivatedSection = hash;
}

/** Reads the section recorded by {@link setActiveSettingsSection}. */
export function getActiveSettingsSection(): string {
  return lastActivatedSection;
}
