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

  it('serializes overlapping saves into one announcement, no false failure', async () => {
    // First save stays in flight; a second fires while it is pending.
    let resolveFirst: (value: boolean) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<boolean>((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValue(true);
    const onOutcome = vi.fn();
    const { result } = renderHook(() =>
      useThemeAutoSave({
        isCustom: true,
        colorValues: VALUES,
        save,
        onOutcome,
      }),
    );

    // Kick off the first save (in flight), then a second while it is pending.
    act(() => result.current.saveNow(VALUES));
    expect(save).toHaveBeenCalledTimes(1);
    act(() => result.current.saveNow(VALUES));
    // The second call must NOT have started its own overlapping save…
    expect(save).toHaveBeenCalledTimes(1);
    // …and must NOT have announced a (false) outcome yet.
    expect(onOutcome).not.toHaveBeenCalled();

    // Settle the first; the stashed second drains, then ONE 'saved' announces.
    await act(async () => {
      resolveFirst(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith('saved');
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
