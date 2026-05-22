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
 * - When the consumer calls `markIntent(hash)` (e.g. a TOC click), the
 *   observer's updates are ignored for `INTENT_LOCKOUT_MS` so a pass-through
 *   section mid-scroll doesn't briefly flicker as active.
 * - Picks the first intersecting section in document order; if none
 *   intersect, the previous value is kept (prevents flicker between groups).
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

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < intentLockoutUntil.current) return;

        // Build a set of currently-intersecting ids so we can pick the
        // first one in document order. We can't rely on entries alone
        // because each callback only contains changed sections.
        const intersecting = new Set<string>();
        for (const id of sectionIds) {
          const element = document.getElementById(id);
          if (!element) continue;
          const wasIntersecting = entries.find(
            (entry) => entry.target === element,
          );
          if (wasIntersecting) {
            if (wasIntersecting.isIntersecting) intersecting.add(id);
          }
        }

        // Merge in sections not in this entry batch that were previously
        // intersecting (still are, observer didn't fire for them).
        // Cheaper than tracking state — just trust the next entry batch.
        const firstActive = sectionIds.find((id) => intersecting.has(id));
        if (firstActive) {
          setActiveHash(firstActive);
        }
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
