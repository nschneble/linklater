/**
 * Tests for useSearchDebounce.
 *
 * Covers the three behaviors that carry the hook's value:
 *   - The debounced value trails the live search by SEARCH_DEBOUNCE_MS.
 *   - An empty search clears the debounced value immediately (fast path,
 *     no debounce wait).
 *   - Changing the filter resets both the live and debounced values.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS } from './useLinksView.utils';
import { useSearchDebounce } from './useSearchDebounce';
import type { LinksFilter } from './types';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSearchDebounce', () => {
  it('trails the live search by SEARCH_DEBOUNCE_MS before updating debouncedSearch', () => {
    const { result } = renderHook(() => useSearchDebounce('unread'));

    act(() => result.current.setSearch('duck'));
    expect(result.current.search).toBe('duck');

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current.debouncedSearch).toBe('');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.debouncedSearch).toBe('duck');
  });

  it('clears the debounced value immediately when the search is emptied', () => {
    const { result } = renderHook(() => useSearchDebounce('unread'));

    act(() => result.current.setSearch('duck'));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current.debouncedSearch).toBe('duck');

    // Emptying the search takes the fast path: no timer, cleared on the
    // next render without advancing the clock.
    act(() => result.current.setSearch(''));
    expect(result.current.debouncedSearch).toBe('');
  });

  it('resets both the live and debounced search when the filter changes', () => {
    const { result, rerender } = renderHook(
      ({ filter }) => useSearchDebounce(filter),
      { initialProps: { filter: 'unread' as LinksFilter } },
    );

    act(() => result.current.setSearch('duck'));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current.search).toBe('duck');
    expect(result.current.debouncedSearch).toBe('duck');

    rerender({ filter: 'read' });

    expect(result.current.search).toBe('');
    expect(result.current.debouncedSearch).toBe('');
  });
});
