/*
 * Tests for useThemeCopy – the copy/apply/undo state machine extracted from the
 * editor. Covers: apply snapshots the prior values, loads the theme's tokens,
 * persists immediately, and announces "applied"; undo restores the snapshot and
 * announces "reverted"; a mode/theme change drops a stale snapshot; and undo is
 * a no-op with nothing to revert.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readThemeTokens } from './themeProbe';
import { useThemeCopy } from './useThemeCopy';
import type { ThemeVariable } from './useThemeOverrides';

vi.mock('./themeProbe', () => ({
  readThemeTokens: vi.fn(() => ({ '--mount-bg': 'probe-value' })),
}));

const COLOR_VALUES = { '--base-bg': '#000' } as unknown as Record<
  ThemeVariable,
  string
>;

function setup(overrides: Partial<Parameters<typeof useThemeCopy>[0]> = {}) {
  const save = vi.fn().mockResolvedValue(true);
  const onSaveFailed = vi.fn();
  const loadOverrides = vi.fn(
    (tokens: Record<string, string>) => tokens as Record<ThemeVariable, string>,
  );
  const initialProps = {
    editingEnabled: true,
    baseTheme: 'boyhood' as const,
    mode: 'dark' as const,
    colorValues: COLOR_VALUES,
    save,
    loadOverrides,
    onSaveFailed,
    ...overrides,
  };
  const view = renderHook((props) => useThemeCopy(props), { initialProps });
  return { ...view, save, onSaveFailed, loadOverrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useThemeCopy', () => {
  it('applies a theme: loads its tokens, persists at once, announces "applied"', async () => {
    const { result, save, loadOverrides } = setup();

    await act(async () => {
      result.current.handleApply('school-of-rock', 'School of Rock');
    });

    expect(readThemeTokens).toHaveBeenCalledWith('school-of-rock', 'dark');
    expect(loadOverrides).toHaveBeenCalledWith({ '--mount-bg': 'probe-value' });
    expect(result.current.undoThemeLabel).toBe('School of Rock');
    expect(save).toHaveBeenCalledWith({ '--mount-bg': 'probe-value' });

    await waitFor(() => expect(result.current.savedCount).toBe(1));
    expect(result.current.savedMessage).toBe(
      'School of Rock palette applied and saved.',
    );
  });

  it('undo restores the pre-apply snapshot and announces the revert', async () => {
    const { result, loadOverrides, save } = setup();

    await act(async () => {
      result.current.handleApply('school-of-rock', 'School of Rock');
    });
    await waitFor(() => expect(result.current.savedCount).toBe(1));
    loadOverrides.mockClear();
    save.mockClear();

    await act(async () => {
      result.current.handleUndo();
    });

    // Restores the snapshot captured from colorValues at apply time.
    expect(loadOverrides).toHaveBeenCalledWith(COLOR_VALUES);
    expect(save).toHaveBeenCalledWith(COLOR_VALUES);
    expect(result.current.undoThemeLabel).toBeNull();
    await waitFor(() => expect(result.current.savedCount).toBe(2));
    expect(result.current.savedMessage).toBe('Reverted to previous colors.');
  });

  it('drops the Undo snapshot when the mode changes', async () => {
    const { result, rerender } = setup();
    await act(async () => {
      result.current.handleApply('school-of-rock', 'School of Rock');
    });
    expect(result.current.undoThemeLabel).toBe('School of Rock');

    act(() => {
      rerender({
        editingEnabled: true,
        baseTheme: 'boyhood',
        mode: 'light',
        colorValues: COLOR_VALUES,
        save: vi.fn().mockResolvedValue(true),
        loadOverrides: vi.fn((tokens) => tokens),
        onSaveFailed: vi.fn(),
      });
    });

    expect(result.current.undoThemeLabel).toBeNull();
  });

  it('undo is a no-op when there is nothing to revert', () => {
    const { result, save } = setup();
    act(() => result.current.handleUndo());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.undoThemeLabel).toBeNull();
  });

  it('routes a failed save to onSaveFailed, not the polite announcement', async () => {
    const failing = vi.fn().mockResolvedValue(false);
    const { result, onSaveFailed } = setup({ save: failing });

    await act(async () => {
      result.current.handleApply('school-of-rock', 'School of Rock');
    });

    await waitFor(() => expect(onSaveFailed).toHaveBeenCalledTimes(1));
    expect(result.current.savedCount).toBe(0);
  });
});
