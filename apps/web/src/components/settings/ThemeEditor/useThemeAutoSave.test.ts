/*
 * Tests for useThemeAutoSave – the debounced, latest-wins auto-save that
 * replaces the editor's Save button. Verifies a burst of edits coalesces into
 * one save, that non-custom themes never persist, that saveNow bypasses the
 * debounce, and that the terminal outcome is reported once.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeAutoSave } from './useThemeAutoSave';
import type { ThemeVariable } from './useThemeOverrides';

const VALUES = { '--base-bg': '#000' } as unknown as Record<
  ThemeVariable,
  string
>;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useThemeAutoSave', () => {
  it('coalesces a burst of edits into a single save', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const onOutcome = vi.fn();
    const { result } = renderHook(() =>
      useThemeAutoSave({
        isCustom: true,
        colorValues: VALUES,
        save,
        onOutcome,
      }),
    );

    act(() => {
      result.current.scheduleSave();
      result.current.scheduleSave();
      result.current.scheduleSave();
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith('saved');
  });

  it('does not save for a non-custom theme', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const onOutcome = vi.fn();
    const { result } = renderHook(() =>
      useThemeAutoSave({
        isCustom: false,
        colorValues: VALUES,
        save,
        onOutcome,
      }),
    );

    act(() => result.current.scheduleSave());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('reports a failed outcome when the save rejects to false', async () => {
    const save = vi.fn().mockResolvedValue(false);
    const onOutcome = vi.fn();
    const { result } = renderHook(() =>
      useThemeAutoSave({
        isCustom: true,
        colorValues: VALUES,
        save,
        onOutcome,
      }),
    );

    act(() => result.current.scheduleSave());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith('failed');
  });

  it('saveNow persists immediately, bypassing the debounce', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const onOutcome = vi.fn();
    const { result } = renderHook(() =>
      useThemeAutoSave({
        isCustom: true,
        colorValues: VALUES,
        save,
        onOutcome,
      }),
    );

    await act(async () => {
      result.current.saveNow(VALUES);
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
