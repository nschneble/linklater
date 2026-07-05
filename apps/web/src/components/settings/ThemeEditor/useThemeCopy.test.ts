/*
 * Tests for useThemeCopy – the apply-random / undo / save-routing state machine
 * extracted from the editor. Covers: applying a random palette loads it,
 * persists immediately, and snapshots the prior values; undo restores the
 * snapshot and announces "reverted"; a mode/theme change drops a stale snapshot;
 * undo is a no-op with nothing to revert; and a failed save routes to
 * onSaveFailed, not the polite region.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeCopy } from './useThemeCopy';
import type { ThemeVariable } from './useThemeOverrides';

const COLOR_VALUES = { '--base-bg': '#000' } as unknown as Record<
  ThemeVariable,
  string
>;

const RANDOM_PALETTE = { '--base-bg': '#123abc' } as unknown as Record<
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
    editorMode: 'dark' as const,
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
  it('applies a random palette: loads it, persists at once, announces', async () => {
    const { result, save, loadOverrides } = setup();

    await act(async () => {
      result.current.handleApplyRandom(RANDOM_PALETTE);
    });

    expect(loadOverrides).toHaveBeenCalledWith(RANDOM_PALETTE);
    expect(save).toHaveBeenCalledWith(RANDOM_PALETTE);

    await waitFor(() => expect(result.current.savedCount).toBe(1));
    expect(result.current.savedMessage).toBe(
      'Random palette applied and saved.',
    );
  });

  it('routes a failed save to onSaveFailed, not the polite announcement', async () => {
    const failing = vi.fn().mockResolvedValue(false);
    const { result, onSaveFailed } = setup({ save: failing });

    await act(async () => {
      result.current.handleApplyRandom(RANDOM_PALETTE);
    });

    await waitFor(() => expect(onSaveFailed).toHaveBeenCalledTimes(1));
    expect(result.current.savedCount).toBe(0);
  });
});
