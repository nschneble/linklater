import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useLinksActions } from './useLinksActions';
import type { Link } from './api';

vi.mock('./api', () => ({
  archiveLink: vi.fn(),
  createLink: vi.fn(),
  deleteAllArchivedLinks: vi.fn(),
  unarchiveLink: vi.fn(),
}));

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
});
