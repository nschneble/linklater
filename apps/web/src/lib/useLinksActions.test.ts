import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/** Captured callback from the most recent useMetadataPolling call. */
let capturedOnSettled: ((link: Link) => void) | null = null;

vi.mock('./useMetadataPolling', () => ({
  useMetadataPolling: vi.fn(
    (_linkId: string | null, onSettled: (link: Link) => void) => {
      capturedOnSettled = onSettled;
    },
  ),
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
    archivedAt: null,
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

  it('metadata polling callback updates the link and clears pendingMetaLinkId', () => {
    const options = makeOptions();
    renderHook(() => useLinksActions(options));

    const updatedLink = makeLink({
      id: 'link-meta',
      url: 'https://updated.com',
    });

    act(() => {
      expect(capturedOnSettled).not.toBeNull();
      capturedOnSettled!(updatedLink);
    });

    expect(options.updateLink).toHaveBeenCalledWith(updatedLink);
  });

  it('handleCreated is a no-op when the archived tab is active', () => {
    const options = makeOptions({ filter: 'archived' });
    const { result } = renderHook(() => useLinksActions(options));

    act(() => result.current.handleCreated(makeLink()));

    expect(options.prependLink).not.toHaveBeenCalled();
    expect(options.adjustTotal).not.toHaveBeenCalled();
    expect(result.current.toastMessage).toBeNull();
  });

  describe('handleDirectSave', () => {
    it('calls createLink and delegates to handleCreated on success', async () => {
      const link = makeLink({ id: 'new-link' });
      vi.mocked(apiModule.createLink).mockResolvedValue(link);
      const options = makeOptions();
      const { result } = renderHook(() => useLinksActions(options));

      await act(() => result.current.handleDirectSave('https://example.com'));

      expect(apiModule.createLink).toHaveBeenCalledWith({
        url: 'https://example.com',
      });
      expect(options.prependLink).toHaveBeenCalledWith(link);
      expect(result.current.saveError).toBeNull();
    });

    it('sets saveError when createLink fails', async () => {
      vi.mocked(apiModule.createLink).mockRejectedValue(new Error('Bad URL'));
      const { result } = renderHook(() => useLinksActions(makeOptions()));

      await act(() => result.current.handleDirectSave('not-a-url'));

      expect(result.current.saveError).toBe('Bad URL');
    });

    it('sets a fallback saveError for non-Error rejections', async () => {
      vi.mocked(apiModule.createLink).mockRejectedValue('boom');
      const { result } = renderHook(() => useLinksActions(makeOptions()));

      await act(() => result.current.handleDirectSave('https://example.com'));

      expect(result.current.saveError).toBe('Failed to save link');
    });
  });

  describe('handleToggleArchive', () => {
    it('archives an active link and removes it from the active list', async () => {
      const link = makeLink({ id: 'link-1', archivedAt: null });
      const archived = makeLink({
        id: 'link-1',
        archivedAt: new Date().toISOString(),
      });
      vi.mocked(apiModule.archiveLink).mockResolvedValue(archived);

      const options = makeOptions({ filter: 'active' });
      const { result } = renderHook(() => useLinksActions(options));

      await act(() => result.current.handleToggleArchive(link));

      expect(apiModule.archiveLink).toHaveBeenCalledWith('link-1');
      expect(options.removeLink).toHaveBeenCalledWith('link-1');
      expect(options.adjustTotal).toHaveBeenCalledWith(-1);
    });

    it('unarchives a link and removes it from the archived list', async () => {
      const link = makeLink({
        id: 'link-1',
        archivedAt: new Date().toISOString(),
      });
      const unarchived = makeLink({ id: 'link-1', archivedAt: null });
      vi.mocked(apiModule.unarchiveLink).mockResolvedValue(unarchived);

      const options = makeOptions({ filter: 'archived' });
      const { result } = renderHook(() => useLinksActions(options));

      await act(() => result.current.handleToggleArchive(link));

      expect(apiModule.unarchiveLink).toHaveBeenCalledWith('link-1');
      expect(options.removeLink).toHaveBeenCalledWith('link-1');
      expect(options.adjustTotal).toHaveBeenCalledWith(-1);
    });

    it('updates link in place when it stays in the current filter', async () => {
      // Archiving on the archived tab would never happen in normal use,
      // but the branch handles: archived tab + archivedAt set → stays in
      // view. Easier to test: active tab + unarchive → stays.
      const link = makeLink({
        id: 'link-1',
        archivedAt: new Date().toISOString(),
      });
      const unarchived = makeLink({ id: 'link-1', archivedAt: null });
      vi.mocked(apiModule.unarchiveLink).mockResolvedValue(unarchived);

      const options = makeOptions({ filter: 'active' });
      const { result } = renderHook(() => useLinksActions(options));

      await act(() => result.current.handleToggleArchive(link));

      expect(options.updateLink).toHaveBeenCalledWith(unarchived);
      expect(options.removeLink).not.toHaveBeenCalled();
    });

    it('sets archiveError when the API call fails', async () => {
      const link = makeLink({ id: 'link-1', archivedAt: null });
      vi.mocked(apiModule.archiveLink).mockRejectedValue(
        new Error('Server error'),
      );

      const { result } = renderHook(() => useLinksActions(makeOptions()));

      await act(() => result.current.handleToggleArchive(link));

      expect(result.current.archiveError).toBe('Server error');
    });

    it('sets a fallback archiveError for non-Error rejections', async () => {
      const link = makeLink({ id: 'link-1', archivedAt: null });
      vi.mocked(apiModule.archiveLink).mockRejectedValue('boom');

      const { result } = renderHook(() => useLinksActions(makeOptions()));

      await act(() => result.current.handleToggleArchive(link));

      expect(result.current.archiveError).toBe('Failed to update link');
    });
  });
});
