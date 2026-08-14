import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinksData } from './useLinksData';
import type { Link, PaginatedLinks } from '../api';

vi.mock('../api', () => ({
  getLinks: vi.fn(),
}));

// stub the metadata poller: no real timers/getLink; one test asserts wiring
let capturedPollingLinks: Link[] | null = null;
let capturedOnSettled: ((link: Link) => void) | null = null;

vi.mock('./usePendingMetadataPolling', () => ({
  usePendingMetadataPolling: vi.fn(
    (links: Link[], onSettled: (link: Link) => void) => {
      capturedPollingLinks = links;
      capturedOnSettled = onSettled;
    },
  ),
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
 * Mocks `getLinks` as an honest paginated endpoint: it slices a fixed
 * backing array by `skip = (page - 1) * limit` / `take = limit`, exactly
 * like the server (`links-query.service.ts`). An omitted request `limit`
 * defaults to the server's `DEFAULT_LIMIT` of 10. `reportedTotal` lets a
 * test simulate server/state drift where `total` exceeds the rows that
 * actually exist. Because the offset is honored, bumping the request limit
 * on a later page will visibly skip a row, reproducing the real bug that a
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

  it('handles a fetch error gracefully and sets loadingLinks=false', async () => {
    vi.mocked(apiModule.getLinks).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.loadingLinks).toBe(false));

    expect(result.current.links).toEqual([]);
  });

  it('clears fetchError on a subsequent successful fetch', async () => {
    const link = makeLink();
    vi.mocked(apiModule.getLinks)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(makePaginated([link]));

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'unread' | 'read'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'unread' as 'unread' | 'read', search: '' } },
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
      { initialProps: { filter: 'unread' as 'unread' | 'read', search: '' } },
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
      { initialProps: { filter: 'unread' as 'unread' | 'read', search: '' } },
    );

    await waitFor(() => expect(result.current.hasSettledOnce).toBe(true));
    expect(result.current.links).toHaveLength(1);

    rerender({ filter: 'unread', search: 'query' });

    // loading flips on for the refetch; prior list stays mounted, not cleared
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
      { initialProps: { filter: 'unread' as 'unread' | 'read', search: '' } },
    );

    await waitFor(() => expect(result.current.links).toHaveLength(3));

    rerender({ filter: 'unread', search: 'no-match' });

    await waitFor(() => expect(result.current.loadingLinks).toBe(true));
    // no mid-fetch flash to empty: prior three items stay until the 2nd response
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

  it('appends only rows a later page has not already served', async () => {
    // a create between pages shifts rows under the offset, re-serving one; append must drop the dupe so keys stay unique
    const existing = makeLink({ id: 'link-a' });
    const reserved = makeLink({ id: 'link-a' });
    const newB = makeLink({ id: 'link-b' });
    const newC = makeLink({ id: 'link-c' });

    vi.mocked(apiModule.getLinks)
      .mockResolvedValueOnce(makePaginated([existing], { total: 10 }))
      .mockResolvedValueOnce(
        makePaginated([reserved, newB, newC], { total: 10, page: 2 }),
      );

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    await act(async () => {
      result.current.handleLoadMore();
    });

    await waitFor(() =>
      expect(result.current.links.some((link) => link.id === 'link-c')).toBe(
        true,
      ),
    );

    const ids = result.current.links.map((link) => link.id);
    expect(ids).toEqual(['link-a', 'link-b', 'link-c']);
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
    // 21 items at limit 10 leave a lone trailing row; a limit-bump desyncs the offset and dups a key, so honoring it exposes the regression
    const backing = makeBacking(21);
    mockOffsetRespectingEndpoint(backing);

    const { result } = renderHook(() => useLinksData('unread', ''));

    await waitFor(() => expect(result.current.links).toHaveLength(10));

    await act(async () => {
      result.current.handleLoadMore();
    });

    // load-more fills rows 10-19, then auto-load pulls the lone row 20 as page 3
    await waitFor(() => expect(result.current.links).toHaveLength(21));

    const ids = result.current.links.map((link) => link.id);
    expect(ids).toEqual(backing.map((link) => link.id));
    expect(new Set(ids).size).toBe(21);

    // limit stays unset so the server offset holds (server uses its default)
    for (const call of vi.mocked(apiModule.getLinks).mock.calls) {
      expect(call[0]?.limit).toBeUndefined();
    }
  });

  it('loads every row without an extra fetch when the tail fills the last page exactly', async () => {
    // 20 items at limit 10: two full pages, no trailing item, so auto-load must not over-fetch
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
    // no lone trailing item, so no auto-load fires: exactly two pages
    expect(vi.mocked(apiModule.getLinks)).toHaveBeenCalledTimes(2);
  });

  it('auto-loads a lone trailing item left by the first page', async () => {
    // 11 items at limit 10: page 1 leaves one, auto-load fetches it with the limit constant
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

describe('useLinksData settled metadata survives a page-1 refetch', () => {
  it('keeps a settled link settled when a later page-1 fetch carries stale null metadata', async () => {
    const settledAt = '2026-07-29T00:00:00.000Z';
    vi.mocked(apiModule.getLinks)
      // First page-1 load: the link is still pending (no fetchedAt yet).
      .mockResolvedValueOnce(makePaginated([makeLink({ id: 'x', meta: null })]))
      // A search keystroke fires a fresh page-1 fetch. A response that predates
      // the metadata job finishing still reports meta: null for the link.
      .mockResolvedValueOnce(
        makePaginated([makeLink({ id: 'x', meta: null })]),
      );

    const { result, rerender } = renderHook(
      ({ filter, search }: { filter: 'unread' | 'read'; search: string }) =>
        useLinksData(filter, search),
      { initialProps: { filter: 'unread' as 'unread' | 'read', search: '' } },
    );

    await waitFor(() => expect(result.current.links).toHaveLength(1));

    // The metadata poller settles the card in place.
    act(() =>
      result.current.updateLink(
        makeLink({ id: 'x', meta: { title: 'Ready', fetchedAt: settledAt } }),
      ),
    );
    expect(result.current.links[0].meta?.fetchedAt).toBe(settledAt);

    // The refetch settles with stale null metadata. The merge must keep the
    // settled meta so a link card's aria-busy (derived from !meta.fetchedAt)
    // never flips false -> true and the card never reverts to its skeleton.
    rerender({ filter: 'unread', search: 'r' });
    await waitFor(() =>
      expect(vi.mocked(apiModule.getLinks)).toHaveBeenCalledTimes(2),
    );

    await waitFor(() =>
      expect(result.current.links[0].meta?.fetchedAt).toBe(settledAt),
    );
    expect(result.current.links[0].meta?.title).toBe('Ready');
  });
});

describe('useLinksData pending metadata polling wiring', () => {
  it('drives the poller with the current links and settles a link via updateLink', async () => {
    const pending = makeLink({ id: 'x', meta: null });
    vi.mocked(apiModule.getLinks).mockResolvedValue(makePaginated([pending]));

    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    // The poller is handed the rendered links, including the pending one.
    expect(capturedPollingLinks?.map((link) => link.id)).toEqual(['x']);
    expect(capturedOnSettled).not.toBeNull();

    // Its onSettled callback is `updateLink`: settling 'x' writes it into
    // state, so a settled poll result lands on the list.
    const settledAt = '2026-07-29T00:00:00.000Z';
    act(() =>
      capturedOnSettled!(
        makeLink({ id: 'x', meta: { title: 'Ready', fetchedAt: settledAt } }),
      ),
    );

    expect(result.current.links[0].meta?.fetchedAt).toBe(settledAt);
    expect(result.current.links[0].meta?.title).toBe('Ready');
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

  it('does not announce when a refocus only settles an existing pending card', async () => {
    // Both hooks fire on the same refocus. The poller settles an existing card
    // in place while the visibility refresh re-fetches page 1 and finds the
    // same link, now carrying metadata. A settle on an existing id is not a new
    // arrival, so `findNewLinks` yields nothing and the live region must stay
    // silent: no phantom "new links added" for a card the user already had.
    const settledAt = '2026-07-29T00:00:00.000Z';
    const settledMeta = { title: 'Ready', fetchedAt: settledAt };

    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated([makeLink({ id: 'x', meta: null })]),
    );
    const { result } = renderHook(() => useLinksData('unread', ''));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    // The refocus refetch returns the same link, now settled.
    vi.mocked(apiModule.getLinks).mockResolvedValueOnce(
      makePaginated([makeLink({ id: 'x', meta: settledMeta })]),
    );

    await act(async () => {
      fireVisibilityChange('visible');
    });

    // The poller settles the same card on the same refocus.
    act(() => capturedOnSettled!(makeLink({ id: 'x', meta: settledMeta })));

    await waitFor(() =>
      expect(vi.mocked(apiModule.getLinks).mock.calls.length).toBeGreaterThan(
        1,
      ),
    );

    expect(result.current.newLinksAnnouncement).toBe('');
    expect(result.current.links[0].meta?.fetchedAt).toBe(settledAt);
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
