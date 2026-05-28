import { scrollToSettingsSection } from './settingsScroll';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

interface UseSettingsScrollSpyOptions {
  /** Section ids in document order. The first id is the default active value. */
  sectionIds: string[];
  /**
   * `rootMargin` for the IntersectionObserver. The default creates a trigger
   * band near the top of the viewport so a section becomes active as soon as
   * its heading enters the upper fifth.
   */
  rootMargin?: string;
}

interface SettingsNavState {
  /** Monotonic token set by `navigateToSettingsSection` on every genuine nav. */
  settingsIntent?: number;
}

/**
 * Safety cap on the intent flag. The flag is meant to release on real user
 * scroll input (wheel, touchmove, scroll-keys, focus moving outside the
 * target). This timeout exists so a stuck flag cannot permanently disable
 * the scroll-spy if those signals never arrive. The cap only flips the
 * flag — it does not recompute `activeHash` — so a stationary user keeps
 * the highlight pinned to the section they intended to land on.
 */
const INTENT_SAFETY_MS = 3000;

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Tab',
  ' ',
  'Spacebar',
]);

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.matches(
    'button, [role="button"], a, input, select, textarea, [contenteditable="true"]',
  );
}

/**
 * Tracks which settings section is currently in view and exposes it as
 * `activeHash`. Uses IntersectionObserver (cheap, browser-debounced) instead
 * of a scroll listener.
 *
 * Navigation is driven entirely by an intent token in history state, set by
 * `navigateToSettingsSection`. This removes the old scroll → URL mirroring
 * (and the echo-counter that disambiguated the spy's own URL writes from real
 * clicks, which raced and could swallow a click). The model now has one clean
 * split:
 *
 * - The IntersectionObserver ONLY updates `activeHash` for highlighting. It
 *   never navigates, so it can never feed back into the navigation path.
 * - A single scroll-owner effect, keyed on the intent token (plus one run on
 *   mount for deep links), owns scrolling + focusing the target section and
 *   pinning intent. Because the token changes on every genuine navigation —
 *   even a repeat click on the current section — the effect re-fires reliably,
 *   while observer-driven `activeHash` changes (no token) are ignored.
 *
 * Intent pin behaviour (unchanged, and not the source of the old bug):
 * - While pinned, the observer cannot override `activeHash`, so a smooth
 *   scroll to the target doesn't flicker the highlight through intermediate
 *   sections.
 * - Intent releases on real user scroll input — `wheel`, `touchmove`, or a
 *   scroll-controlling key (Space gated so it doesn't release while focus is
 *   on an interactive element) — and when focus moves outside the active
 *   section (covers Tab-away and AT virtual-cursor jumps). A 3s safety timer
 *   caps the pin; it only flips the flag, never setState, so a stationary user
 *   keeps their highlight.
 * - Programmatic smooth scrolls fire `scroll` but never `wheel`/`touchmove`,
 *   so this cleanly distinguishes them from user input.
 *
 * Intersection state is persisted in a ref across observer batches because
 * IntersectionObserver only fires entries for sections whose state changed —
 * relying on the current batch alone would miss sections still intersecting
 * from a previous batch.
 */
export function useSettingsScrollSpy({
  sectionIds,
  rootMargin = '-20% 0px -60% 0px',
}: UseSettingsScrollSpyOptions) {
  const parameters = useParams<{ section?: string }>();
  const location = useLocation();
  const sectionParameter = parameters.section ?? '';
  const intentToken = (location.state as SettingsNavState | null)
    ?.settingsIntent;

  const initialActive =
    sectionParameter && sectionIds.includes(sectionParameter)
      ? sectionParameter
      : (sectionIds[0] ?? '');
  const [activeHash, setActiveHash] = useState<string>(initialActive);
  const activeHashRef = useRef<string>(initialActive);
  const intentActive = useRef<boolean>(
    Boolean(sectionParameter && sectionIds.includes(sectionParameter)),
  );
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intersectionState = useRef<Map<string, boolean>>(new Map());
  // True once the mount-time scroll-owner pass has run. Distinguishes a
  // full-page-load deep link (no intent token, scroll once on mount) from a
  // later in-app navigation (carries a token).
  const didInitialScroll = useRef<boolean>(false);
  // The last intent token the scroll-owner effect acted on. Guards against
  // re-firing for a token restored by browser back/forward, which would yank
  // focus/scroll on a back navigation.
  const lastServicedIntent = useRef<number | undefined>(undefined);

  // Keep a ref in sync with activeHash so event listeners can read the
  // current value without re-binding when it changes.
  useEffect(() => {
    activeHashRef.current = activeHash;
  }, [activeHash]);

  const activateIntent = useCallback(() => {
    intentActive.current = true;
    if (intentTimer.current) clearTimeout(intentTimer.current);
    intentTimer.current = setTimeout(() => {
      intentActive.current = false;
      intentTimer.current = null;
    }, INTENT_SAFETY_MS);
  }, []);

  const releaseIntent = useCallback(() => {
    if (!intentActive.current) return;
    intentActive.current = false;
    if (intentTimer.current) {
      clearTimeout(intentTimer.current);
      intentTimer.current = null;
    }
    const firstActive = sectionIds.find(
      (id) => intersectionState.current.get(id) === true,
    );
    if (firstActive) setActiveHash(firstActive);
  }, [sectionIds]);

  // Scroll owner: the single place that scrolls + focuses a section and pins
  // intent. Fires for an in-app navigation (fresh intent token) and once on
  // mount for a full-page-load deep link.
  useEffect(() => {
    const isIntentNavigation =
      intentToken != null && intentToken !== lastServicedIntent.current;
    const isInitialDeepLink = !didInitialScroll.current;
    didInitialScroll.current = true;

    if (!isIntentNavigation && !isInitialDeepLink) return;
    if (intentToken != null) lastServicedIntent.current = intentToken;
    if (!sectionParameter) return;

    if (sectionIds.includes(sectionParameter)) {
      // Pin and sync the active ref SYNCHRONOUSLY before moving focus. The
      // `focusin`-outside release guard reads `activeHashRef.current`; if it
      // still held the previous section when `scrollToSettingsSection` focuses
      // the target, the guard would test the wrong element, release intent
      // mid-navigation, and let the observer fight the nav.
      setActiveHash(sectionParameter);
      activeHashRef.current = sectionParameter;
      activateIntent();
    }
    scrollToSettingsSection(sectionParameter);
  }, [intentToken, sectionParameter, sectionIds, activateIntent]);

  // Real user scroll input releases intent so natural scrolling lets the
  // observer take over. `scroll` is too eager — smooth programmatic scrolls
  // also fire it — so we listen for the input events the user actually
  // generates. `focusin` outside the active section covers Tab navigation
  // and AT focus jumps (NVDA/JAWS/VoiceOver virtual cursor) that would
  // otherwise be invisible to wheel/touchmove listeners.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!intentActive.current) return;
      const isSpace = event.key === ' ' || event.key === 'Spacebar';
      if (isSpace && isInteractiveTarget(event.target)) return;
      if (SCROLL_KEYS.has(event.key)) releaseIntent();
    }
    function handleFocusIn(event: FocusEvent) {
      if (!intentActive.current) return;
      const activeId = activeHashRef.current;
      if (!activeId) return;
      const activeElement = document.getElementById(activeId);
      if (activeElement && activeElement.contains(event.target as Node)) return;
      releaseIntent();
    }
    window.addEventListener('wheel', releaseIntent, { passive: true });
    window.addEventListener('touchmove', releaseIntent, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      window.removeEventListener('wheel', releaseIntent);
      window.removeEventListener('touchmove', releaseIntent);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [releaseIntent]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    // Reset state for the current set of sections.
    intersectionState.current = new Map(sectionIds.map((id) => [id, false]));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (id) intersectionState.current.set(id, entry.isIntersecting);
        }

        if (intentActive.current) return;

        const firstActive = sectionIds.find(
          (id) => intersectionState.current.get(id) === true,
        );
        if (firstActive) setActiveHash(firstActive);
      },
      { rootMargin, threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [sectionIds, rootMargin]);

  useEffect(() => {
    return () => {
      if (intentTimer.current) clearTimeout(intentTimer.current);
    };
  }, []);

  return { activeHash };
}
