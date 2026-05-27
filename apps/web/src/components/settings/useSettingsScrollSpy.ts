import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

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
 * - On `location.hash` change, the active hash snaps to it and an "intent"
 *   flag is pinned so the observer cannot override it mid-scroll.
 * - When the consumer calls `markIntent(hash)` (e.g. a TOC click), the
 *   active hash snaps to that hash and intent is pinned the same way.
 *   Snapping here matters when the URL hash already equals the clicked
 *   section: `navigate(`#${hash}`)` is a no-op, the location effect does
 *   not re-fire, and we still need the highlight to land on the click.
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
  const location = useLocation();
  const initialHash = location.hash.slice(1);
  const initialActive =
    initialHash && sectionIds.includes(initialHash)
      ? initialHash
      : (sectionIds[0] ?? '');
  const [activeHash, setActiveHash] = useState<string>(initialActive);
  const activeHashRef = useRef<string>(initialActive);
  const intentActive = useRef<boolean>(
    Boolean(initialHash && sectionIds.includes(initialHash)),
  );
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intersectionState = useRef<Map<string, boolean>>(new Map());

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

  // Hash-driven updates beat the observer. When something deep-links into a
  // section (browser load with a hash, or `navigate('#foo')`), snap the
  // active hash and pin intent so the observer cannot drift off-target.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash && sectionIds.includes(hash)) {
      setActiveHash(hash);
      activateIntent();
    }
  }, [location.hash, sectionIds, activateIntent]);

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

  const markIntent = useCallback(
    (hash: string) => {
      if (hash && sectionIds.includes(hash)) setActiveHash(hash);
      activateIntent();
    },
    [sectionIds, activateIntent],
  );

  return { activeHash, markIntent };
}
