import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchParamsReducer, useLinksData } from './useLinksData';
import type { Link, PaginatedLinks } from '../api';

vi.mock('../api', () => ({
  getLinks: vi.fn(),
}));

import * as apiModule from '../api';

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    meta: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: null,
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

describe('fetchParamsReducer', () => {
  it('reset changes filter and resets page to 1', () => {
    const state = { filter: 'unread' as const, page: 3, search: '' };
    const next = fetchParamsReducer(state, {
      type: 'reset',
      filter: 'read',
      search: '',
    });
    expect(next).toEqual({ filter: 'read', page: 1, search: '' });
  });

  it('reset returns same reference when filter and search are unchanged', () => {
    const state = { filter: 'unread' as const, page: 2, search: 'hello' };
    const next = fetchParamsReducer(state, {
      type: 'reset',
      filter: 'unread',
      search: 'hello',
    });
    expect(next).toBe(state);
  });

  it('load-more increments page', () => {
    const state = { filter: 'unread' as const, page: 1, search: '' };
    const next = fetchParamsReducer(state, { type: 'load-more' });
    expect(next.page).toBe(2);
  });
});

describe('useLinksData initial fetch', () => {
  it('starts with loadingLinks=true and an empty links array', () => {
    vi.mocked(apiModule.getLinks).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useLinksData('unread', ''));

    expect(result.current.loadingLinks).toBe(true);
    expect(result.current.links).toEqual([]);
  });

  it('populates links after the fetch resolves', async () => {
    const link = makeLink();
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([link]));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].id).toBe('link-1');
  });

  it('sets pagination metadata from the response', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()], { total: 42, limit: 10 }),
    );

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.pagination).toEqual({ total: 42, limit: 10 });
  });

  it('calls getLinks with read=false for the unread filter', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('unread', ''));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ read: false }),
      ),
    );
  });

  it('calls getLinks with read=true for the read filter', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('read', ''));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ read: true }),
      ),
    );
  });

  it('passes the search term to getLinks when provided', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('unread', 'duck'));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'duck' }),
      ),
    );
  });

  it('passes undefined as search when the search string is empty', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    renderHook(() => useLinksData('unread', ''));

    await waitFor(() =>
      expect(apiModule.getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ search: undefined }),
      ),
    );
  });

  it('handles a fetch error gracefully and sets loadingLinks=false', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.links).toEqual([]);
  });

  it('sets fetchError when the fetch rejects', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() =>
      expect(result.current.fetchError).toBe('Network error'),
    );
  });

  it('clears fetchError on a subsequent successful fetch', async () => {
    const link = makeLink();
    vi.mocked(apiModule.getLinks)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(makePaginated([link]));

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'unread' | 'read'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'unread' as const, search: '' } },
    );

    await waitFor(() =>
      expect(result.current.fetchError).toBe('Network error'),
    );

    rerender({ filter: 'read', search: '' });

    await waitFor(() => expect(result.current.fetchError).toBeNull());
  });
});

describe('useLinksData stale request guard', () => {
  it('does not update state when the component unmounts before the fetch resolves', async () => {
    let resolveRequest: ((value: PaginatedLinks) => void) | null = null;

    vi.mocked(apiModule.getLinks).mockImplementation(
      () =>
        new Promise<PaginatedLinks>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useLinksData('unread', ''));

    unmount();

    await act(async () => {
      resolveRequest!(makePaginated([makeLink()]));
    });

    expect(result.current.links).toEqual([]);
  });
});

describe('useLinksData re-fetch on filter change', () => {
  it('resets links and re-fetches when the filter changes', async () => {
    const unreadLink = makeLink({ id: 'unread-1' });
    const readLink = makeLink({ id: 'read-1' });

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([unreadLink]))
      .mockResolvedValueOnce(makePaginated([readLink]));

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'unread' | 'read'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'unread' as const, search: '' } },
    );

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    rerender({ filter: 'read', search: '' });

    await waitFor(() => expect(result.current.links[0]?.id).toBe('read-1'));
  });
});

describe('useLinksData handleLoadMore', () => {
  it('appends the next page results to existing links', async () => {
    const page1 = makeLink({ id: 'p1' });
    const page2 = makeLink({ id: 'p2' });

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([page1], { total: 2 }))
      .mockResolvedValueOnce(makePaginated([page2], { total: 2, page: 2 }));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() => expect(result.current.links).toHaveLength(2));

    expect(result.current.links.map((link) => link.id)).toEqual(['p1', 'p2']);
  });

  it('increments page number after load-more', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([]));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.page).toBe(1);

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() => expect(result.current.page).toBe(2));
  });
});

describe('useLinksData mutation helpers', () => {
  it('prependLink inserts a link at the top and deduplicates by id', async () => {
    const existing = makeLink({ id: 'old' });
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([existing]));

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    const fresh = makeLink({ id: 'new' });
    act(() => result.current.prependLink(fresh));

    expect(result.current.links[0].id).toBe('new');
    expect(result.current.links).toHaveLength(2);

    act(() => result.current.prependLink(fresh));
    expect(result.current.links).toHaveLength(2);
  });

  it('updateLink replaces the matching link in the list', async () => {
    const original = makeLink({ id: 'link-1', url: 'https://old.com' });
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([original]));

    const { result } = renderHook(() => useLinksData('unread', ''));
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

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(2));

    act(() => result.current.removeLink('remove'));

    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].id).toBe('keep');
  });

  it('clearLinks empties the links array', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()]),
    );

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    act(() => result.current.clearLinks());

    expect(result.current.links).toEqual([]);
  });

  it('adjustTotal nudges pagination total by delta', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()], { total: 10 }),
    );

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.pagination?.total).toBe(10));

    act(() => result.current.adjustTotal(-1));
    expect(result.current.pagination?.total).toBe(9);

    act(() => result.current.adjustTotal(3));
    expect(result.current.pagination?.total).toBe(12);
  });

  it('adjustTotal is a no-op when pagination is null', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.pagination).toBeNull();

    act(() => result.current.adjustTotal(1));
    expect(result.current.pagination).toBeNull();
  });

  it('resetTotal sets pagination total to 0', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()], { total: 5 }),
    );

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.pagination?.total).toBe(5));

    act(() => result.current.resetTotal());
    expect(result.current.pagination?.total).toBe(0);
  });

  it('resetTotal is a no-op when pagination is null', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    act(() => result.current.resetTotal());
    expect(result.current.pagination).toBeNull();
  });
});
