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

  it('leaves the form open when no successful create occurs', () => {
    // A failed create never reaches `handleCreated` — LinkForm swallows the
    // error locally and only calls `onCreated` on success. This guards against
    // the close wiring drifting onto an always-run path (render/effect), which
    // would hide the error Alert by collapsing the form.
    const { result } = renderHook(() => useLinks('unread', ''));

    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(true);

    // Re-render without a create; the form must stay open.
    act(() => result.current.handleToggleForm());
    act(() => result.current.handleToggleForm());

    expect(result.current.showLinkForm).toBe(true);
  });
});
