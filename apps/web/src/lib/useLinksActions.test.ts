import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { useLinksActions } from './useLinksActions';
import type { Link } from './api';

vi.mock('./api', () => ({
  archiveLink: vi.fn(),
  createLink: vi.fn(),
  deleteAllArchivedLinks: vi.fn(),
  unarchiveLink: vi.fn(),
}));

import * as apiModule from './api';

vi.mock('./useRandomLink', () => ({
  useRandomLink: () => ({
    handleRandom: vi.fn(),
    randomError: null,
    randomLoading: false,
  }),
}));

vi.mock('./useMetadataPolling', () => ({
  useMetadataPolling: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: '1',
    url: 'https://example.com',
    title: null,
    description: null,
    imageUrl: null,
    faviconUrl: null,
    siteName: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    metadataFetchedAt: null,
    userId: 'user-1',
    ...overrides,
  };
}

function makeOptions(overrides: object = {}) {
  return {
    adjustTotal: vi.fn(),
    clearLinks: vi.fn(),
    filter: 'active' as const,
    links: [],
    prependLink: vi.fn(),
    removeLink: vi.fn(),
    resetTotal: vi.fn(),
    updateLink: vi.fn(),
    ...overrides,
  };
}

describe('useLinksActions', () => {
  it('toastMessage is null initially', () => {
    const { result } = renderHook(() => useLinksActions(makeOptions()));
    expect(result.current.toastMessage).toBeNull();
  });

  it('archiveError is null initially', () => {
    const { result } = renderHook(() => useLinksActions(makeOptions()));
    expect(result.current.archiveError).toBeNull();
  });

  it('saveError is null initially', () => {
    const { result } = renderHook(() => useLinksActions(makeOptions()));
    expect(result.current.saveError).toBeNull();
  });

  it('handleCreated sets toast message', () => {
    const { result } = renderHook(() => useLinksActions(makeOptions()));
    act(() => result.current.handleCreated(makeLink()));
    expect(result.current.toastMessage).toBe('Link saved!');
  });

  it('handleCreated calls prependLink and adjustTotal for new link', () => {
    const options = makeOptions({ links: [] });
    const { result } = renderHook(() => useLinksActions(options));
    act(() => result.current.handleCreated(makeLink()));
    expect(options.prependLink).toHaveBeenCalled();
    expect(options.adjustTotal).toHaveBeenCalledWith(1);
  });

  it('handleCreated does not adjustTotal for existing link', () => {
    const link = makeLink();
    const options = makeOptions({ links: [link] });
    const { result } = renderHook(() => useLinksActions(options));
    act(() => result.current.handleCreated(link));
    expect(options.prependLink).toHaveBeenCalled();
    expect(options.adjustTotal).not.toHaveBeenCalled();
  });

  it('handleDismissToast clears toastMessage', async () => {
    const { result } = renderHook(() => useLinksActions(makeOptions()));

    act(() => result.current.handleCreated(makeLink()));
    expect(result.current.toastMessage).toBe('Link saved!');

    act(() => result.current.handleDismissToast());
    expect(result.current.toastMessage).toBeNull();
  });

  it('deleteError is null initially', () => {
    const { result } = renderHook(() => useLinksActions(makeOptions()));
    expect(result.current.deleteError).toBeNull();
  });

  it('handleDeleteAllArchived clears links and resets total on success', async () => {
    vi.mocked(apiModule.deleteAllArchivedLinks).mockResolvedValue({ count: 2 });
    const options = makeOptions();
    const { result } = renderHook(() => useLinksActions(options));

    await act(() => result.current.handleDeleteAllArchived());

    expect(options.clearLinks).toHaveBeenCalled();
    expect(options.resetTotal).toHaveBeenCalled();
    expect(result.current.deleteError).toBeNull();
  });

  it('handleDeleteAllArchived sets deleteError when the API call fails', async () => {
    vi.mocked(apiModule.deleteAllArchivedLinks).mockRejectedValue(
      new Error('Network error'),
    );
    const { result } = renderHook(() => useLinksActions(makeOptions()));

    await act(() => result.current.handleDeleteAllArchived());

    expect(result.current.deleteError).toBe('Network error');
  });

  it('handleDeleteAllArchived sets a fallback deleteError for non-Error rejections', async () => {
    vi.mocked(apiModule.deleteAllArchivedLinks).mockRejectedValue('boom');
    const { result } = renderHook(() => useLinksActions(makeOptions()));

    await act(() => result.current.handleDeleteAllArchived());

    expect(result.current.deleteError).toBe('Failed to delete archived links');
  });
});
