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

describe('useLinksActions', () => {
  it('toastMessage is null initially', () => {
    const { result } = renderHook(() =>
      useLinksActions({
        filter: 'active',
        setLinks: vi.fn(),
        setPagination: vi.fn(),
      }),
    );
    expect(result.current.toastMessage).toBeNull();
  });

  it('handleDismissToast clears toastMessage', async () => {
    const setLinks = vi.fn();
    const setPagination = vi.fn();
    const { result } = renderHook(() =>
      useLinksActions({ filter: 'active', setLinks, setPagination }),
    );

    const link = makeLink();
    act(() => result.current.handleCreated(link));
    expect(result.current.toastMessage).toBe('Link saved!');

    act(() => result.current.handleDismissToast());
    expect(result.current.toastMessage).toBeNull();
  });

  it('handleCreated sets toast message', () => {
    const { result } = renderHook(() =>
      useLinksActions({
        filter: 'active',
        setLinks: vi.fn(),
        setPagination: vi.fn(),
      }),
    );
    act(() => result.current.handleCreated(makeLink()));
    expect(result.current.toastMessage).toBe('Link saved!');
  });

  it('saveError is null initially', () => {
    const { result } = renderHook(() =>
      useLinksActions({
        filter: 'active',
        setLinks: vi.fn(),
        setPagination: vi.fn(),
      }),
    );
    expect(result.current.saveError).toBeNull();
  });
});
