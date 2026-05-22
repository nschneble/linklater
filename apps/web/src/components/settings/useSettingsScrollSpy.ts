import { useEffect, useRef, useState } from 'react';
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

const INTENT_LOCKOUT_MS = 700;

/**
 * Tracks which settings section is currently in view and exposes it as
 * `activeHash`. Uses IntersectionObserver (cheap, browser-debounced) instead
 * of a scroll listener.
 *
 * - On `location.hash` change, the active hash snaps to it immediately.
 * - When the consumer calls `markIntent()` (e.g. a TOC click), the
 *   observer's updates are ignored for `INTENT_LOCKOUT_MS` so a pass-through
 *   section mid-scroll doesn't briefly flicker as active.
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
  const intentLockoutUntil = useRef<number>(0);
  const intersectionState = useRef<Map<string, boolean>>(new Map());

  // Hash-driven updates beat the observer. When the user clicks a TOC link,
  // React Router updates location.hash and we snap immediately.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash && sectionIds.includes(hash)) {
      setActiveHash(hash);
      intentLockoutUntil.current = Date.now() + INTENT_LOCKOUT_MS;
    }
  }, [location.hash, sectionIds]);

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

        if (Date.now() < intentLockoutUntil.current) return;

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

  function markIntent() {
    intentLockoutUntil.current = Date.now() + INTENT_LOCKOUT_MS;
  }

  return { activeHash, markIntent };
}
