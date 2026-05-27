import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiDocsToken } from './useApiDocsToken';

const SESSION_KEY = 'linklater.api-docs.pat';

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useApiDocsToken', () => {
  it('hydrates from sessionStorage on first render', () => {
    window.sessionStorage.setItem(SESSION_KEY, 'ltk_cached');
    const { result } = renderHook(() => useApiDocsToken());
    expect(result.current[0]).toBe('ltk_cached');
  });

  it('returns an empty string when nothing is cached', () => {
    const { result } = renderHook(() => useApiDocsToken());
    expect(result.current[0]).toBe('');
  });

  it('writes new values through to sessionStorage', () => {
    const { result } = renderHook(() => useApiDocsToken());
    act(() => result.current[1]('ltk_newtoken'));
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe('ltk_newtoken');
  });

  it('removes the sessionStorage key when cleared to an empty string', () => {
    window.sessionStorage.setItem(SESSION_KEY, 'ltk_existing');
    const { result } = renderHook(() => useApiDocsToken());
    act(() => result.current[1](''));
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('swallows sessionStorage failures during read', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const { result } = renderHook(() => useApiDocsToken());
    expect(result.current[0]).toBe('');
    getItem.mockRestore();
  });

  it('swallows sessionStorage failures during write and still updates local state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => useApiDocsToken());
    // The hook must not throw even when sessionStorage.setItem throws.
    expect(() => {
      act(() => result.current[1]('ltk_willnottopersist'));
    }).not.toThrow();
    // Local state still reflects the new value.
    expect(result.current[0]).toBe('ltk_willnottopersist');
  });
});
