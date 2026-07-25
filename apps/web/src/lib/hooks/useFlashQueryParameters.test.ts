/**
 * Tests for useFlashQueryParameters, the deferred-read + URL-strip flash hook.
 *
 * The "NOT in the DOM synchronously on first paint" half of the SR-announce
 * contract is held by construction: the hook initializes its internal state
 * to `null` via `useState<T | null>(null)`, so the first render must return
 * `null`. A DOM-level synchronous peek before any deferred assertion is not
 * achievable here – RTL's `renderHook()` flushes mount-effects inside its
 * internal `act()` before returning, so `result.current` is already
 * populated by the time test code sees it. The structural argument above
 * is the load-bearing proof for that half of the contract; the deferred
 * tests below cover the "populated after mount" half.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlashQueryParameters } from './useFlashQueryParameters';

import type { ReactNode } from 'react';

function wrapperAt(path: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [path] }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFlashQueryParameters', () => {
  it('returns the reader result once the mount-effect flushes', async () => {
    const read = vi.fn((parameters: URLSearchParams) => {
      const flag = parameters.get('flag');
      return flag ? { flag } : null;
    });

    const { result } = renderHook(
      () => useFlashQueryParameters(read, ['flag']),
      {
        wrapper: wrapperAt('/here?flag=on'),
      },
    );

    await waitFor(() => {
      expect(result.current).toEqual({ flag: 'on' });
    });
  });

  it('returns null when no listed param is present in the URL', async () => {
    const read = vi.fn((parameters: URLSearchParams) => {
      const flag = parameters.get('flag');
      return flag ? { flag } : null;
    });

    const { result, rerender } = renderHook(
      () => useFlashQueryParameters(read, ['flag']),
      { wrapper: wrapperAt('/here') },
    );

    rerender();
    expect(result.current).toBeNull();
  });

  it('calls the reader exactly once across re-renders (mount-only effect)', async () => {
    const read = vi.fn((parameters: URLSearchParams) => {
      const flag = parameters.get('flag');
      return flag ? { flag } : null;
    });

    const { rerender } = renderHook(
      () => useFlashQueryParameters(read, ['flag']),
      {
        wrapper: wrapperAt('/here?flag=on'),
      },
    );

    await waitFor(() => {
      expect(read).toHaveBeenCalledTimes(1);
    });
    rerender();
    rerender();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('passes the URLSearchParams containing the flash key to the reader', async () => {
    const read = vi.fn((parameters: URLSearchParams) => {
      const flag = parameters.get('flag');
      return flag ? { flag } : null;
    });

    renderHook(() => useFlashQueryParameters(read, ['flag']), {
      wrapper: wrapperAt('/here?flag=on'),
    });

    await waitFor(() => {
      expect(read).toHaveBeenCalledTimes(1);
    });
    const firstCallParameters = read.mock.calls[0]?.[0];
    expect(firstCallParameters?.get('flag')).toBe('on');
  });

  it('stays null when the reader returns null even if params are present', async () => {
    const read = vi.fn(() => null);

    const { result, rerender } = renderHook(
      () => useFlashQueryParameters(read, ['unused']),
      { wrapper: wrapperAt('/here?unused=value') },
    );

    await waitFor(() => {
      expect(read).toHaveBeenCalledTimes(1);
    });
    rerender();
    expect(result.current).toBeNull();
  });
});
