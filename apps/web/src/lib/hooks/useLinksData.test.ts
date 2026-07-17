import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchParamsReducer, useLinksData } from './useLinksData';
import { findNewLinks, formatNewLinksAnnouncement } from './linksData.utils';
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

/**
 * Builds a fixed backing array of links with zero-padded, sortable ids
 * (`link-00`, `link-01`, …) so a dropped or duplicated row is obvious when
 * comparing the loaded ids against the backing order.
 */
function makeBacking(count: number): Link[] {
  const links: Link[] = [];
  for (let index = 0; index < count; index += 1) {
    links.push(makeLink({ id: `link-${String(index).padStart(2, '0')}` }));
  }
  return links;
}

/**
 * Mocks `getLinks` as an HONEST paginated endpoint: it slices a fixed
 * backing array by `skip = (page - 1) * limit` / `take = limit`, exactly
 * like the server (`links-query.service.ts`). An omitted request `limit`
 * defaults to the server's `DEFAULT_LIMIT` of 10. `reportedTotal` lets a
 * test simulate server/state drift where `total` exceeds the rows that
 * actually exist. Because the offset is honored, bumping the request limit
 * on a later page will visibly skip a row — reproducing the real bug that a
 * hand-authored per-call mock would hide.
 */
function mockOffsetRespectingEndpoint(
  backing: Link[],
  reportedTotal: number = backing.length,
): void {
  vi.mocked(apiModule.getLinks).mockImplementation(async (options) => {
    const limit = options?.limit ?? 10;
    const page = options?.page ?? 1;
    const skip = (page - 1) * limit;
    return {
      data: backing.slice(skip, skip + limit),
      total: reportedTotal,
      page,
      limit,
    };
  });
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

  it('load-more preserves filter and search while only advancing the page', () => {
    const state = { filter: 'read' as const, page: 2, search: 'duck' };
    const next = fetchParamsReducer(state, { type: 'load-more' });
    expect(next).toEqual({ filter: 'read', page: 3, search: 'duck' });
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

describe('useLinksData hasSettledOnce', () => {
  it('starts false and flips to true after the first fetch settles', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink()]),
    );

    const { result } = renderHook(() => useLinksData('unread', ''));

    expect(result.current.hasSettledOnce).toBe(false);

    await waitFor(() => expect(result.current.hasSettledOnce).toBe(true));
  });

  it('flips to true even when the first fetch fails', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.hasSettledOnce).toBe(true));
  });

  it('keeps the prior list mounted while a search re-fetch is pending', async () => {
    const original = makeLink({ id: 'a' });
    let resolveSecond: ((value: PaginatedLinks) => void) | null = null;

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([original]))
      .mockImplementationOnce(
        () =>
          new Promise<PaginatedLinks>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'unread' | 'read'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'unread' as const, search: '' } },
    );

    await waitFor(() => expect(result.current.hasSettledOnce).toBe(true));
    expect(result.current.links).toHaveLength(1);

    rerender({ filter: 'unread', search: 'query' });

    // Loading flag flips on for the second fetch, but the previous list
    // remains mounted instead of being cleared to [] mid-fetch.
    await waitFor(() => expect(result.current.loadingLinks).toBe(true));
    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].id).toBe('a');
    expect(result.current.hasSettledOnce).toBe(true);

    await act(async () => {
      resolveSecond!(makePaginated([makeLink({ id: 'b' })]));
    });

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));
    expect(result.current.links[0].id).toBe('b');
  });

  it('keeps the prior list mounted then transitions to empty on a no-match settle', async () => {
    let resolveSecond: ((value: PaginatedLinks) => void) | null = null;

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(
        makePaginated([
          makeLink({ id: 'a' }),
          makeLink({ id: 'b' }),
          makeLink({ id: 'c' }),
        ]),
      )
      .mockImplementationOnce(
        () =>
          new Promise<PaginatedLinks>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'unread' | 'read'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'unread' as const, search: '' } },
    );

    await waitFor(() => expect(result.current.links).toHaveLength(3));

    rerender({ filter: 'unread', search: 'no-match' });

    await waitFor(() => expect(result.current.loadingLinks).toBe(true));
    // No mid-fetch flash to empty: the prior three items remain rendered
    // until the second response arrives.
    expect(result.current.links).toHaveLength(3);

    await act(async () => {
      resolveSecond!(makePaginated([], { total: 0 }));
    });

    await waitFor(() => expect(result.current.links).toHaveLength(0));
    expect(result.current.loadingLinks).toBe(false);
  });
});

describe('useLinksData handleLoadMore', () => {
  it('appends the next page results to existing links', async () => {
    const page1 = makeLink({ id: 'p1' });
    const page2a = makeLink({ id: 'p2a' });
    const page2b = makeLink({ id: 'p2b' });

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([page1], { total: 3 }))
      .mockResolvedValueOnce(
        makePaginated([page2a, page2b], { total: 3, page: 2 }),
      );

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() => expect(result.current.links).toHaveLength(3));

    expect(result.current.links.map((link) => link.id)).toEqual([
      'p1',
      'p2a',
      'p2b',
    ]);
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

describe('useLinksData "less doesn\'t need more"', () => {
  it('never drops or duplicates a row when the tail is one item past a full page', async () => {
    // 21 items at the default limit of 10: page 1 loads rows 0–9, load-more
    // loads rows 10–19, leaving exactly one trailing row. The old limit-bump
    // desynced the server's (page - 1) * limit offset — it skipped row 10 and
    // re-served row 20 (a duplicate React key). Honoring the offset here means
    // that regression is now visible.
    const backing = makeBacking(21);
    mockOffsetRespectingEndpoint(backing);

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(10));

    await act(async () => {
      result.current.handleLoadMore();
    });

    // load-more fills rows 10–19, then the auto-load net pulls the single
    // trailing row 20 as its own page 3.
    await waitFor(() => expect(result.current.links).toHaveLength(21));

    const ids = result.current.links.map((link) => link.id);
    expect(ids).toEqual(backing.map((link) => link.id));
    expect(new Set(ids).size).toBe(21);

    // The limit is never bumped: every request keeps the server offset stable
    // by leaving `limit` unset (the server falls back to its default).
    for (const call of vi.mocked(apiModule.getLinks).mock.calls) {
      expect(call[0]?.limit).toBeUndefined();
    }
  });

  it('loads every row without an extra fetch when the tail fills the last page exactly', async () => {
    // 20 items at the default limit of 10: two full pages, no trailing item.
    // The absent-tail direction — the auto-load net must NOT over-fetch.
    const backing = makeBacking(20);
    mockOffsetRespectingEndpoint(backing);

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(10));

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() => expect(result.current.links).toHaveLength(20));

    const ids = result.current.links.map((link) => link.id);
    expect(ids).toEqual(backing.map((link) => link.id));
    expect(new Set(ids).size).toBe(20);
    // No lone trailing item remains, so no auto-load fires: exactly two pages.
    expect(vi.mocked(apiModule.getLinks)).toHaveBeenCalledTimes(2);
  });

  it('auto-loads a lone trailing item left by the first page', async () => {
    // 11 items at the default limit of 10: page 1 leaves exactly one item.
    // The auto-load net fetches it with no user interaction, keeping the
    // limit constant across both pages (total ≡ 1 mod page-size boundary).
    const backing = makeBacking(11);
    mockOffsetRespectingEndpoint(backing);

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(11));

    const ids = result.current.links.map((link) => link.id);
    expect(ids).toEqual(backing.map((link) => link.id));
    expect(vi.mocked(apiModule.getLinks)).toHaveBeenCalledTimes(2);
  });

  it('does not loop when the auto-fired follow-up returns no new rows', async () => {
    // Backing holds 10 rows but the endpoint reports total=11 (server/state
    // drift). Page 1 returns all 10 with one row still claimed missing, so the
    // auto-load fires once, gets nothing, and the guard stops a refetch loop.
    const backing = makeBacking(10);
    mockOffsetRespectingEndpoint(backing, 11);

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));
    // Give the effect ample chance to fire again – it must not.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(apiModule.getLinks)).toHaveBeenCalledTimes(2);
    expect(result.current.links).toHaveLength(10);
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

describe('findNewLinks', () => {
  it('returns only links not present in existing', () => {
    const existing = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    const incoming = [
      makeLink({ id: 'a' }),
      makeLink({ id: 'c' }),
      makeLink({ id: 'd' }),
    ];
    expect(findNewLinks(incoming, existing).map((link) => link.id)).toEqual([
      'c',
      'd',
    ]);
  });

  it('returns empty array when all incoming links already exist', () => {
    const existing = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    const incoming = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    expect(findNewLinks(incoming, existing)).toEqual([]);
  });

  it('returns all incoming links when existing is empty', () => {
    const incoming = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    expect(findNewLinks(incoming, []).map((link) => link.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('formatNewLinksAnnouncement', () => {
  it('returns singular form for count of 1', () => {
    expect(formatNewLinksAnnouncement(1)).toBe('1 new link added');
  });

  it('returns plural form for counts greater than 1', () => {
    expect(formatNewLinksAnnouncement(2)).toBe('2 new links added');
    expect(formatNewLinksAnnouncement(10)).toBe('10 new links added');
  });

  it('returns plural form for count of 0', () => {
    expect(formatNewLinksAnnouncement(0)).toBe('0 new links added');
  });
});

describe('visibility refresh', () => {
  function fireVisibilityChange(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('does nothing when the filter is "read"', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink({ id: 'a' })]),
    );
    const { result } = renderHook(() => useLinksData('read', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    vi.mocked(apiModule.getLinks).mockClear();
    await act(async () => {
      fireVisibilityChange('visible');
    });

    expect(apiModule.getLinks).not.toHaveBeenCalled();
  });

  it('does nothing when search is non-empty', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValue(
      makePaginated([makeLink({ id: 'a' })]),
    );
    const { result } = renderHook(() => useLinksData('unread', 'query'));
    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    vi.mocked(apiModule.getLinks).mockClear();
    await act(async () => {
      fireVisibilityChange('visible');
    });

    expect(apiModule.getLinks).not.toHaveBeenCalled();
  });

  it('prepends newly arrived links and updates the live-region announcement', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated([makeLink({ id: 'a' })]),
    );
    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated(
        [
          makeLink({ id: 'new-1' }),
          makeLink({ id: 'new-2' }),
          makeLink({ id: 'a' }),
        ],
        { total: 3 },
      ),
    );

    await act(async () => {
      fireVisibilityChange('visible');
    });

    await waitFor(() => {
      expect(result.current.links.map((link) => link.id)).toEqual([
        'new-1',
        'new-2',
        'a',
      ]);
    });

    await waitFor(() => {
      expect(result.current.newLinksAnnouncement).toBe('2 new links added');
    });
  });

  it('does not modify state or announce when no new links arrive', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated([makeLink({ id: 'a' })], { total: 1 }),
    );
    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated([makeLink({ id: 'a' })], { total: 1 }),
    );

    await act(async () => {
      fireVisibilityChange('visible');
    });

    await waitFor(() =>
      expect(vi.mocked(apiModule.getLinks).mock.calls.length).toBeGreaterThan(
        1,
      ),
    );

    expect(result.current.links).toHaveLength(1);
    expect(result.current.newLinksAnnouncement).toBe('');
  });

  it('silently swallows refresh errors without setting fetchError', async () => {
    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated([makeLink({ id: 'a' })]),
    );
    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    vi.mocked(apiModule.getLinks).mockRejectedValueOnce(
      new Error('network down'),
    );

    await act(async () => {
      fireVisibilityChange('visible');
    });

    await waitFor(() =>
      expect(vi.mocked(apiModule.getLinks).mock.calls.length).toBeGreaterThan(
        1,
      ),
    );

    expect(result.current.fetchError).toBeNull();
  });
});
