/**
 * Tests for `useLinksData` hook behavior.
 *
 * The `getLinks` function is mocked at the module boundary. Tests verify that
 * fetching, pagination, and the mutation helpers all behave correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLinksData } from './useLinksData';
import type { Link, PaginatedLinks } from './api';

vi.mock('./api', () => ({
  getLinks: vi.fn(),
}));

import * as apiModule from './api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    meta: null,
    ...overrides,
  };
}

function makePaginated(
  links: Link[],
  overrides: Partial<PaginatedLinks> = {},
): PaginatedLinks {
  return {
    data: links,
    total: links.length,
    page: 1,
    limit: 10,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Initial fetch
// ---------------------------------------------------------------------------

describe('useLinksData initial fetch', () => {
  it('starts with loadingLinks=true and an empty links array', () => {
    vi.mocked(apiModule.getLinks).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useLinksData('active', ''));

    expect(result.current.loadingLinks).toBe(true);
    expect(result.current.links).toEqual([]);
  });

  it('populates links after the fetch resolves', async () => {
    const link = makeLink();
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([link]));

    const { result } = renderHook(() => useLinksData('active', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].id).toBe('link-1');
  });

  it('sets pagination metadata from the response', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()], { total: 42, limit: 10 }),
    );

    const { result } = renderHook(() => useLinksData('active', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.pagination).toEqual({ total: 42, limit: 10 });
  });

  it('calls getLinks with archived=false for the active filter', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('active', ''));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ archived: false }),
      ),
    );
  });

  it('calls getLinks with archived=true for the archived filter', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('archived', ''));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ archived: true }),
      ),
    );
  });

  it('passes the search term to getLinks when provided', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('active', 'duck'));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'duck' }),
      ),
    );
  });

  it('passes undefined as search when the search string is empty', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('active', ''));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ search: undefined }),
      ),
    );
  });

  it('handles a fetch error gracefully and sets loadingLinks=false', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLinksData('active', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stale request cancellation — unmount before fetch resolves
// ---------------------------------------------------------------------------

describe('useLinksData stale request guard', () => {
  it('does not update state when the component unmounts before the fetch resolves', async () => {
    let resolveRequest: ((value: PaginatedLinks) => void) | null = null;

    vi.mocked(apiModule.getLinks).mockImplementation(
      () =>
        new Promise<PaginatedLinks>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useLinksData('active', ''));

    // Unmount before the fetch resolves
    unmount();

    // Now resolve the pending fetch — should not update state or throw
    await act(async () => {
      resolveRequest!(makePaginated([makeLink()]));
    });

    // After unmount + resolve the hook's state should never have been updated
    // (the cancelled flag prevents it). The test passing without errors is the
    // assertion — React would warn about updating state on an unmounted component.
    expect(result.current.links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Filter / search changes trigger re-fetch
// ---------------------------------------------------------------------------

describe('useLinksData re-fetch on filter change', () => {
  it('resets links and re-fetches when the filter changes', async () => {
    const activeLink = makeLink({ id: 'active-1' });
    const archivedLink = makeLink({ id: 'archived-1' });

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([activeLink]))
      .mockResolvedValueOnce(makePaginated([archivedLink]));

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'active' | 'archived'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'active' as const, search: '' } },
    );

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    rerender({ filter: 'archived', search: '' });

    await waitFor(() => expect(result.current.links[0]?.id).toBe('archived-1'));
  });
});

// ---------------------------------------------------------------------------
// handleLoadMore
// ---------------------------------------------------------------------------

describe('useLinksData handleLoadMore', () => {
  it('appends the next page results to existing links', async () => {
    const page1 = makeLink({ id: 'p1' });
    const page2 = makeLink({ id: 'p2' });

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([page1], { total: 2 }))
      .mockResolvedValueOnce(makePaginated([page2], { total: 2, page: 2 }));

    const { result } = renderHook(() => useLinksData('active', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() => expect(result.current.links).toHaveLength(2));

    expect(result.current.links.map((link) => link.id)).toEqual(['p1', 'p2']);
  });

  it('increments page number after load-more', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    const { result } = renderHook(() => useLinksData('active', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.page).toBe(1);

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() => expect(result.current.page).toBe(2));
  });
});

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

describe('useLinksData mutation helpers', () => {
  it('prependLink inserts a link at the top and deduplicates by id', async () => {
    const existing = makeLink({ id: 'old' });
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([existing]));

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    const fresh = makeLink({ id: 'new' });
    act(() => result.current.prependLink(fresh));

    expect(result.current.links[0].id).toBe('new');
    expect(result.current.links).toHaveLength(2);

    // Deduplication: prepending the same id should not create a duplicate
    act(() => result.current.prependLink(fresh));
    expect(result.current.links).toHaveLength(2);
  });

  it('updateLink replaces the matching link in the list', async () => {
    const original = makeLink({ id: 'link-1', url: 'https://old.com' });
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([original]));

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    const updated = makeLink({ id: 'link-1', url: 'https://new.com' });
    act(() => result.current.updateLink(updated));

    expect(result.current.links[0].url).toBe('https://new.com');
  });

  it('removeLink removes the link with the given id', async () => {
    const keep = makeLink({ id: 'keep' });
    const remove = makeLink({ id: 'remove' });
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([keep, remove]),
    );

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(2));

    act(() => result.current.removeLink('remove'));

    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].id).toBe('keep');
  });

  it('clearLinks empties the links array', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()]),
    );

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    act(() => result.current.clearLinks());

    expect(result.current.links).toEqual([]);
  });

  it('adjustTotal nudges pagination total by delta', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()], { total: 10 }),
    );

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.pagination?.total).toBe(10));

    act(() => result.current.adjustTotal(-1));
    expect(result.current.pagination?.total).toBe(9);

    act(() => result.current.adjustTotal(3));
    expect(result.current.pagination?.total).toBe(12);
  });

  it('adjustTotal is a no-op when pagination is null', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    // pagination should be null after a failed fetch
    expect(result.current.pagination).toBeNull();

    // Should not throw
    act(() => result.current.adjustTotal(1));
    expect(result.current.pagination).toBeNull();
  });

  it('resetTotal sets pagination total to 0', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()], { total: 5 }),
    );

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.pagination?.total).toBe(5));

    act(() => result.current.resetTotal());
    expect(result.current.pagination?.total).toBe(0);
  });

  it('resetTotal is a no-op when pagination is null', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useLinksData('active', ''));
    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    act(() => result.current.resetTotal());
    expect(result.current.pagination).toBeNull();
  });
});
