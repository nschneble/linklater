import { SEARCH_DEBOUNCE_MS } from './useLinksView.utils';
import { useEffect, useState, useTransition } from 'react';
import type { LinksFilter } from './types';

export interface UseSearchDebounceResult {
  /** The live search term, updated on every keystroke. */
  search: string;
  /**
   * The search term after the debounce window, used to drive the actual
   * request. Updated inside a transition so typing stays responsive.
   */
  debouncedSearch: string;
  /** Sets the live search term. */
  setSearch: (value: string) => void;
}

/**
 * Owns the search term and its debounced counterpart. The debounced value
 * trails `search` by {@link SEARCH_DEBOUNCE_MS} and is updated inside a
 * transition so the input stays responsive while results re-render. Both
 * values reset to the empty string whenever the active filter changes.
 *
 * @param filter - The current links filter; changing it clears the search.
 * @returns The live + debounced search terms and the setter.
 */
export function useSearchDebounce(
  filter: LinksFilter,
): UseSearchDebounceResult {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (search === '') {
      startTransition(() => setDebouncedSearch(''));
      return;
    }
    const timer = setTimeout(
      () => startTransition(() => setDebouncedSearch(search)),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  // reset search when the filter changes (e.g. unread vs read tabs)
  useEffect(() => {
    setSearch('');
    setDebouncedSearch('');
  }, [filter]);

  return { search, debouncedSearch, setSearch };
}
