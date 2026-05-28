import { scrollToSettingsSection } from './settingsScroll';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
 * - On `useParams().section` change, the active hash snaps to it and an
 *   "intent" flag is pinned so the observer cannot override it mid-scroll.
 * - Intent releases when the user produces real scroll input — `wheel`,
 *   `touchmove`, or a scroll-controlling key (with Space gated so it does
 *   not release while focus is on an interactive element). It also
 *   releases when focus moves outside the active section, which covers
 *   screen-reader virtual cursor jumps and Tab-away navigation. A safety
 *   timer caps the pin at 3s; that timer only flips the flag, it does
 *   not setState, so a stationary user keeps their highlight.
 * - Programmatic smooth scrolls fire `scroll` events but never `wheel`
 *   or `touchmove`, so this cleanly distinguishes them from user input.
 * - Picks the first intersecting section in document order; if none
 *   intersect, the previous value is kept (prevents flicker between groups).
 * - When a scroll-driven section change occurs, the URL is kept in sync via
 *   `navigate('/settings/<hash>', { replace: true })` so back/forward does
 *   not get spammed with one entry per section the user scrolled past.
 *
 * Intersection state is persisted in a ref across observer batches because
 * IntersectionObserver only fires entries for sections whose state changed
 * — relying on the current batch alone would miss sections that are still
 * intersecting from a previous batch.
 */
export function useSettingsScrollSpy({
  sectionIds,
  rootMargin = '-20% 0px -60% 0px',
}: UseSettingsScrollSpyOptions) {
  const parameters = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const sectionParameter = parameters.section ?? '';
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
  // Echo tokens distinguish the spy's own `replace` navigations (which must
  // NOT re-pin intent or re-scroll) from genuine external navigations (deep
  // link, sidebar click) that should snap + pin. The observer bumps
  // `echoesSent` immediately before each `replace`; the section-param effect
  // consumes exactly one by advancing `echoesConsumed` to match. A genuine
  // navigation that arrives when the two counters are equal has no pending
  // echo to consume, so it is never mistaken for the spy's own — even when it
  // targets the same section the spy last mirrored. Storing the section *name*
  // (the previous approach) could mis-suppress a genuine click to that same
  // section; a one-shot token cannot.
  const echoesSent = useRef<number>(0);
  const echoesConsumed = useRef<number>(0);

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

  // Section-param-driven updates beat the observer. When something deep-links
  // into a section (browser load with a section path, or
  // `navigate('/settings/<section>')`), snap the active hash and pin intent
  // so the observer cannot drift off-target.
  //
  // Skip the spy's own URL echo: when the observer mirrors a scroll-driven
  // section change into the URL via `replace`, it bumps `echoesSent` first.
  // Re-pinning intent here would make scrolling feel sticky (every section
  // the user scrolls past would pin for up to 3s). Each echo is consumed
  // exactly once — by advancing `echoesConsumed` — so a later genuine
  // navigation (even to the same section) has no pending echo and still pins.
  useEffect(() => {
    if (echoesConsumed.current < echoesSent.current) {
      echoesConsumed.current = echoesSent.current;
      return;
    }
    if (sectionParameter && sectionIds.includes(sectionParameter)) {
      setActiveHash(sectionParameter);
      activateIntent();
      // Genuine navigation into a tracked section (deep link, sidebar click,
      // initial page load) scrolls + focuses the section. The spy's own URL
      // echoes are filtered out above so a scroll past a section does not
      // yank the viewport back to its top.
      scrollToSettingsSection(sectionParameter);
    }
  }, [sectionParameter, sectionIds, activateIntent]);

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
        if (firstActive) {
          // Mirror the active section into the URL with `replace` so
          // back/forward isn't spammed with one entry per scroll. Skip the
          // navigation when nothing would change. Bump the echo counter first
          // so the `sectionParameter` effect recognises the resulting param
          // change as the spy's own echo (one-shot) and does not re-pin intent.
          if (firstActive !== activeHashRef.current) {
            echoesSent.current += 1;
            navigate(`/settings/${firstActive}`, { replace: true });
          }
          setActiveHash(firstActive);
        }
      },
      { rootMargin, threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [sectionIds, rootMargin, navigate]);

  useEffect(() => {
    return () => {
      if (intentTimer.current) clearTimeout(intentTimer.current);
    };
  }, []);

  return { activeHash };
}
