import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { filterFromPath, useLinksView } from './useLinksView';
import { setShortcutsEnabled } from './useShortcutsEnabled';
import type { UseLinksResult } from './types';

/**
 * `useLinksView` composes `useLinks`, which fans out to the real fetch +
 * mutation layer. Stub it to a quiet, fully-typed shape so the facade can be
 * exercised in isolation. Only `handleDeleteAllRead` carries behavior: it
 * returns a promise we never resolve, so `isClearingRead` stays `true` while
 * we drive the filter change under test.
 */
let resolveDeleteAllRead: (() => void) | undefined;

const linksStub: UseLinksResult = {
  fetchError: null,
  readError: null,
  deleteError: null,
  handleCreated: vi.fn(),
  handleDeleteAllRead: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveDeleteAllRead = resolve;
      }),
  ),
  handleDismissToast: vi.fn(),
  handleLoadMore: vi.fn(),
  handleRandom: vi.fn(),
  handleToggleRead: vi.fn(),
  handleToggleForm: vi.fn(),
  hasSettledOnce: true,
  links: [],
  loadingLinks: false,
  newLinksAnnouncement: '',
  page: 1,
  pagination: null,
  randomError: null,
  randomLoading: false,
  saveError: null,
  showLinkForm: false,
  toastMessage: null,
};

vi.mock('./useLinks', () => ({
  useLinks: () => linksStub,
}));

function wrapperAt(path: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [path] }, children);
  };
}

describe('filterFromPath', () => {
  it('returns "read" for the /read pathname', () => {
    expect(filterFromPath('/read')).toBe('read');
  });

  it('returns "unread" for the /unread pathname', () => {
    expect(filterFromPath('/unread')).toBe('unread');
  });

  it('returns "unread" for the root pathname', () => {
    expect(filterFromPath('/')).toBe('unread');
  });

  it('returns "unread" for any pathname that is not exactly /read', () => {
    expect(filterFromPath('/settings')).toBe('unread');
    expect(filterFromPath('/read/extra')).toBe('unread');
    expect(filterFromPath('')).toBe('unread');
  });
});

describe('useLinksView', () => {
  it('resets isClearingRead to false when the filter changes', async () => {
    const { result } = renderHook(() => useLinksView(), {
      wrapper: wrapperAt('/read'),
    });

    // Start a clear-read: the stubbed delete stays pending, so the flag is
    // latched on until something resets it.
    act(() => {
      void result.current.handleClearRead();
    });
    expect(result.current.isClearingRead).toBe(true);

    // Navigate /read -> /unread mid-flight. The filter changes, which must
    // reset the flag even though the delete promise has not settled.
    act(() => {
      result.current.onNavigateUnread();
    });
    expect(result.current.filter).toBe('unread');
    expect(result.current.isClearingRead).toBe(false);

    // Settle the pending delete so the `finally` state update flushes inside
    // act() and no unhandled promise leaks past the test.
    await act(async () => {
      resolveDeleteAllRead?.();
    });
  });
});

describe('useLinksView keyboard-shortcuts preference', () => {
  afterEach(() => {
    window.localStorage.clear();
    linksStub.handleRandom.mockClear();
  });

  function fireKey(key: string) {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
  }

  it('fires the stumble shortcut (d) when shortcuts are enabled', () => {
    renderHook(() => useLinksView(), { wrapper: wrapperAt('/unread') });

    act(() => fireKey('d'));

    expect(linksStub.handleRandom).toHaveBeenCalledOnce();
  });

  it('does not fire the stumble shortcut (d) when shortcuts are disabled', () => {
    act(() => setShortcutsEnabled(false));
    renderHook(() => useLinksView(), { wrapper: wrapperAt('/unread') });

    act(() => fireKey('d'));

    expect(linksStub.handleRandom).not.toHaveBeenCalled();
  });
});
