import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from './useReducedMotion';

type EmittableMediaQueryList = MediaQueryList & {
  _emit: (matches: boolean) => void;
};

function makeMediaQueryList(matches: boolean): EmittableMediaQueryList {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  return {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      listeners.push(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    _emit(newMatches: boolean) {
      const event = { matches: newMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  } as unknown as EmittableMediaQueryList;
}

function stubMatchMedia(mediaQueryList: MediaQueryList): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mediaQueryList),
  });
}

describe('useReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial value', () => {
    it('returns false when prefers-reduced-motion does not match', () => {
      stubMatchMedia(makeMediaQueryList(false));
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);
    });

    it('returns true when prefers-reduced-motion matches', () => {
      stubMatchMedia(makeMediaQueryList(true));
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(true);
    });
  });

  describe('runtime media-query changes', () => {
    it('updates from false to true when the OS preference changes to reduce motion', () => {
      const mediaQueryList = makeMediaQueryList(false);
      stubMatchMedia(mediaQueryList);

      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);

      act(() => {
        mediaQueryList._emit(true);
      });

      expect(result.current).toBe(true);
    });

    it('updates from true to false when the OS preference changes to allow motion', () => {
      const mediaQueryList = makeMediaQueryList(true);
      stubMatchMedia(mediaQueryList);

      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(true);

      act(() => {
        mediaQueryList._emit(false);
      });

      expect(result.current).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes the change listener on unmount', () => {
      const mediaQueryList = makeMediaQueryList(false);
      const removeListenerSpy = vi.spyOn(mediaQueryList, 'removeEventListener');
      stubMatchMedia(mediaQueryList);

      const { unmount } = renderHook(() => useReducedMotion());
      unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });
  });

  describe('when matchMedia is unavailable', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    });

    it('returns false as the safe default', () => {
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);
    });
  });
});
