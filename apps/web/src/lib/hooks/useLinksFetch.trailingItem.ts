import { useEffect, useRef } from 'react';

/** What the trailing-item rule needs to know about the current list. */
export interface TrailingItemState {
  loadingLinks: boolean;
  pagination: { total: number; limit: number } | null;
  linkCount: number;
  /** Key of the last auto-load this rule fired, or null if it never has. */
  lastFiredKey: string | null;
}

/**
 * Decides whether a lone trailing row should be pulled as its own follow-up
 * page, so nobody is ever shown a "Load more" button that yields one item.
 *
 * Returns the key to record before firing, or null to stay put. The key is
 * what stops a loop: a follow-up page can come back with no new rows, leaving
 * the counts exactly as they were, and a rule keyed only on "one remaining"
 * would then fire forever.
 *
 * See https://unsung.aresluna.org/less-doesnt-need-more/
 */
export function shouldAutoLoadTrailingItem({
  loadingLinks,
  pagination,
  linkCount,
  lastFiredKey,
}: TrailingItemState): string | null {
  if (loadingLinks) return null;
  if (!pagination) return null;
  if (linkCount === 0) return null;
  if (pagination.total - linkCount !== 1) return null;

  const key = `${linkCount}:${pagination.total}`;
  if (lastFiredKey === key) return null;
  return key;
}

/**
 * Runs the rule on every settle and calls `onFire` when a trailing row is
 * waiting. The already-fired key is held here rather than in the caller so it
 * cannot drift away from the rule that reads it.
 */
export function useTrailingItemAutoLoad(
  state: Omit<TrailingItemState, 'lastFiredKey'>,
  onFire: () => void,
): void {
  const lastFiredKeyReference = useRef<string | null>(null);
  const { loadingLinks, pagination, linkCount } = state;

  useEffect(() => {
    const key = shouldAutoLoadTrailingItem({
      loadingLinks,
      pagination,
      linkCount,
      lastFiredKey: lastFiredKeyReference.current,
    });
    if (key === null) return;
    lastFiredKeyReference.current = key;
    onFire();
    // onFire is a stable dispatch; listing it would refire on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingLinks, pagination, linkCount]);
}
