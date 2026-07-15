import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinks } from './useLinks';
import type { Link } from '../api';

vi.mock('../api', () => ({
  createLink: vi.fn(),
  readLink: vi.fn(),
  unreadLink: vi.fn(),
  deleteAllReadLinks: vi.fn(),
}));

vi.mock('./useMetadataPolling', () => ({
  useMetadataPolling: vi.fn(),
}));

/**
 * `useLinksData` owns the fetch lifecycle. Stub it so `useLinks` can be
 * exercised in isolation without hitting the network or a router.
 */
const dataStub = {
  adjustTotal: vi.fn(),
  clearLinks: vi.fn(),
  fetchError: null,
  handleLoadMore: vi.fn(),
  hasSettledOnce: true,
  links: [] as Link[],
  loadingLinks: false,
  newLinksAnnouncement: '',
  page: 1,
  pagination: null,
  prependLink: vi.fn(),
  removeLink: vi.fn(),
  resetTotal: vi.fn(),
  updateLink: vi.fn(),
};

vi.mock('./useLinksData', () => ({
  useLinksData: vi.fn(() => dataStub),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: '1',
    url: 'https://example.com',
    meta: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

describe('useLinks form auto-close', () => {
  it('closes the inline form after a successful create', () => {
    const { result } = renderHook(() => useLinks('unread', ''));

    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(true);

    act(() => result.current.handleCreated(makeLink()));

    expect(result.current.showLinkForm).toBe(false);
  });

  it('keeps the form open across re-renders when no create occurs', () => {
    // `handleCreated` (a successful create) is the sole close trigger; a failed
    // create never reaches it, since LinkForm swallows the error locally. This
    // guards against `closeForm` drifting onto an always-run path: re-rendering
    // the hook runs every render + effect path, so if close were wired there
    // this re-render would collapse the open form and hide a pending error
    // Alert. Opening then re-rendering without a create must leave it open.
    const { result, rerender } = renderHook(() => useLinks('unread', ''));

    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(true);

    // Re-render without a successful create; the form must stay open.
    rerender();

    expect(result.current.showLinkForm).toBe(true);
  });
});
