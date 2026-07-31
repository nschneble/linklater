import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useTransientState } from './useTransientState';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function useTestHarness(initial: string) {
  const [value, setValue] = useState(initial);
  useTransientState(value, 'idle', setValue);
  return { value, setValue };
}

describe('useTransientState', () => {
  it('does nothing while the value is the reset value', () => {
    const { result } = renderHook(() => useTestHarness('idle'));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.value).toBe('idle');
  });

  it('resets to the idle value after the default delay', () => {
    const { result } = renderHook(() => useTestHarness('idle'));
    act(() => result.current.setValue('busy'));
    expect(result.current.value).toBe('busy');
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.value).toBe('idle');
  });

  it('cancels a pending reset when the value flips again', () => {
    const { result } = renderHook(() => useTestHarness('idle'));
    act(() => result.current.setValue('busy'));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.setValue('other'));
    act(() => vi.advanceTimersByTime(500));
    // 1500ms elapsed total, but the second setValue restarted the timer
    expect(result.current.value).toBe('other');
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.value).toBe('idle');
  });

  it('honors a custom delay', () => {
    function useShortDelay() {
      const [value, setValue] = useState<'idle' | 'busy'>('idle');
      useTransientState(value, 'idle', setValue, 100);
      return { value, setValue };
    }
    const { result } = renderHook(() => useShortDelay());
    act(() => result.current.setValue('busy'));
    act(() => vi.advanceTimersByTime(99));
    expect(result.current.value).toBe('busy');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.value).toBe('idle');
  });
});
