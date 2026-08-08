/**
 * The `GET /links` request shaping and outcome, lifted out of the effect.
 *
 * Two rules live here that were previously only observable by driving the
 * whole hook: an empty search string must reach the API as `undefined` rather
 * than an empty filter, and page 1 merges over the current list while later
 * pages append. Cancellation stays in the hook, since that is React lifecycle.
 */

import { describe, expect, it, vi } from 'vitest';
import { loadLinksPage } from './useLinksFetch.page';

const page = (overrides = {}) => ({
  data: [],
  total: 0,
  limit: 10,
  ...overrides,
});

describe('loadLinksPage', () => {
  it('maps an empty search to undefined so it is not sent as a filter', async () => {
    const fetchLinks = vi.fn().mockResolvedValue(page());

    await loadLinksPage({ filter: 'unread', page: 1, search: '' }, fetchLinks);

    expect(fetchLinks).toHaveBeenCalledWith({
      search: undefined,
      read: false,
      page: 1,
    });
  });

  it('passes a real search term through and flags the read filter', async () => {
    const fetchLinks = vi.fn().mockResolvedValue(page());

    await loadLinksPage(
      { filter: 'read', page: 3, search: 'montreal' },
      fetchLinks,
    );

    expect(fetchLinks).toHaveBeenCalledWith({
      search: 'montreal',
      read: true,
      page: 3,
    });
  });

  it.each([
    ['merge', 1],
    ['append', 2],
    ['append', 9],
  ])('resolves to %s on page %i', async (mode, pageNumber) => {
    const fetchLinks = vi.fn().mockResolvedValue(page({ total: 5 }));

    const outcome = await loadLinksPage(
      { filter: 'unread', page: pageNumber, search: '' },
      fetchLinks,
    );

    expect(outcome).toMatchObject({ status: 'loaded', mode });
  });

  it('carries the page data and pagination through on success', async () => {
    const links = [{ id: 'a' }, { id: 'b' }];
    const fetchLinks = vi
      .fn()
      .mockResolvedValue(page({ data: links, total: 42, limit: 10 }));

    const outcome = await loadLinksPage(
      { filter: 'unread', page: 1, search: '' },
      fetchLinks,
    );

    expect(outcome).toEqual({
      status: 'loaded',
      mode: 'merge',
      data: links,
      pagination: { total: 42, limit: 10 },
    });
  });

  it('resolves to a failure rather than throwing', async () => {
    const fetchLinks = vi.fn().mockRejectedValue(new Error('network is down'));

    const outcome = await loadLinksPage(
      { filter: 'unread', page: 1, search: '' },
      fetchLinks,
    );

    expect(outcome).toEqual({ status: 'failed', message: 'network is down' });
  });

  it('falls back to a readable message when the failure carries none', async () => {
    const fetchLinks = vi.fn().mockRejectedValue({});

    const outcome = await loadLinksPage(
      { filter: 'unread', page: 1, search: '' },
      fetchLinks,
    );

    expect(outcome).toEqual({
      status: 'failed',
      message: 'Failed to load links',
    });
  });
});
