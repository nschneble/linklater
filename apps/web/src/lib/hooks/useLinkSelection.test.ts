import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinkSelection } from './useLinkSelection';
import type { Link } from '../api';

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

describe('useLinkSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('open', vi.fn());
  });

  describe('handleOpenSelectedLink', () => {
    it('opens the selected link in a new tab and marks it read', () => {
      const link = makeLink();
      const onToggleRead = vi.fn();
      const { result } = renderHook(() =>
        useLinkSelection({
          links: [link],
          filter: 'unread',
          debouncedSearch: '',
          onToggleRead,
        }),
      );

      act(() => result.current.handleNavigateNextLink());
      act(() => result.current.handleOpenSelectedLink());

      expect(window.open).toHaveBeenCalledWith(
        link.url,
        '_blank',
        'noreferrer',
      );
      expect(onToggleRead).toHaveBeenCalledWith(link);
    });

    it('does not open a legacy non-http(s) link and does not mark it read', () => {
      const link = makeLink({ url: 'javascript:alert(1)' });
      const onToggleRead = vi.fn();
      const { result } = renderHook(() =>
        useLinkSelection({
          links: [link],
          filter: 'unread',
          debouncedSearch: '',
          onToggleRead,
        }),
      );

      act(() => result.current.handleNavigateNextLink());
      act(() => result.current.handleOpenSelectedLink());

      expect(window.open).not.toHaveBeenCalled();
      expect(onToggleRead).not.toHaveBeenCalled();
    });

    it('does nothing when no link is selected', () => {
      const onToggleRead = vi.fn();
      const { result } = renderHook(() =>
        useLinkSelection({
          links: [makeLink()],
          filter: 'unread',
          debouncedSearch: '',
          onToggleRead,
        }),
      );

      act(() => result.current.handleOpenSelectedLink());

      expect(window.open).not.toHaveBeenCalled();
    });
  });
});
