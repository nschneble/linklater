/*
 * Tests for useThemeSave – the Theme Editor's custom-theme Save state machine.
 *
 * Verifies that Save persists only the CURRENT mode's tokens (preserving the
 * other mode), calls both localStorage (`setCustomTheme`) and the backend
 * (`updateMe`), follows the clear-error → loading → attempt → result sequence,
 * suppresses re-entry while a request is in flight, and surfaces errors.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/api', () => ({
  updateMe: vi.fn(),
}));

const setCustomThemeMock = vi.fn();
const themeState = {
  customTheme: null as {
    dark: Record<string, string>;
    light: Record<string, string>;
  } | null,
  mode: 'dark' as 'dark' | 'light',
  setCustomTheme: setCustomThemeMock,
};

vi.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => themeState,
}));

import { EDITABLE_VARS, type ThemeVariable } from './useThemeOverrides';
import { updateMe } from '../../../lib/api';
import { useThemeSave } from './useThemeSave';

function buildColorValues(value: string): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, value]),
  ) as Record<ThemeVariable, string>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateMe).mockResolvedValue(undefined);
  themeState.customTheme = null;
  themeState.mode = 'dark';
});

describe('useThemeSave', () => {
  it('persists the current mode tokens to localStorage and the backend', async () => {
    const { result } = renderHook(() => useThemeSave('dark'));

    await act(async () => {
      await result.current.save(buildColorValues('#123456'));
    });

    expect(setCustomThemeMock).toHaveBeenCalledTimes(1);
    expect(updateMe).toHaveBeenCalledTimes(1);
    const persisted = setCustomThemeMock.mock.calls[0][0];
    // current mode is dark, so every editable token landed under `dark`
    expect(Object.keys(persisted.dark).length).toBe(EDITABLE_VARS.length);
    expect(persisted.dark['--mount-bg']).toBe('#123456');
    expect(persisted.light).toEqual({});
  });

  it('preserves the other mode tokens when saving', async () => {
    themeState.customTheme = {
      dark: {},
      light: { '--mount-bg': '#abcdef' },
    };
    themeState.mode = 'dark';
    const { result } = renderHook(() => useThemeSave('dark'));

    await act(async () => {
      await result.current.save(buildColorValues('#000000'));
    });

    const persisted = setCustomThemeMock.mock.calls[0][0];
    expect(persisted.light).toEqual({ '--mount-bg': '#abcdef' });
    expect(persisted.dark['--mount-bg']).toBe('#000000');
  });

  it('sends the same payload to setCustomTheme and updateMe', async () => {
    const { result } = renderHook(() => useThemeSave('dark'));

    await act(async () => {
      await result.current.save(buildColorValues('#222222'));
    });

    const persisted = setCustomThemeMock.mock.calls[0][0];
    expect(updateMe).toHaveBeenCalledWith({ customTheme: persisted });
  });

  it('surfaces an error message when the backend rejects', async () => {
    vi.mocked(updateMe).mockRejectedValue(new Error('Network down'));
    const { result } = renderHook(() => useThemeSave('dark'));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.save(buildColorValues('#333333'));
    });

    expect(outcome).toBe(false);
    await waitFor(() => expect(result.current.error).toBe('Network down'));
    expect(result.current.isSaving).toBe(false);
  });

  it('returns true and clears error on success', async () => {
    const { result } = renderHook(() => useThemeSave('dark'));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.save(buildColorValues('#444444'));
    });

    expect(outcome).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('suppresses a re-entrant save while one is already in flight', async () => {
    // hold the first updateMe open so isSaving stays true across the gap
    let releaseUpdate: () => void = () => undefined;
    vi.mocked(updateMe).mockReturnValue(
      new Promise<void>((resolve) => {
        releaseUpdate = resolve;
      }),
    );

    const { result } = renderHook(() => useThemeSave('dark'));

    // first save: starts and parks on the pending updateMe (sets isSaving)
    let firstSave: Promise<boolean> | undefined;
    act(() => {
      firstSave = result.current.save(buildColorValues('#555555'));
    });
    expect(result.current.isSaving).toBe(true);

    // second save sees isSaving=true, short-circuits before updateMe
    let secondOutcome: boolean | undefined;
    await act(async () => {
      secondOutcome = await result.current.save(buildColorValues('#666666'));
    });
    expect(secondOutcome).toBe(false);
    expect(updateMe).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseUpdate();
      await firstSave;
    });
    expect(updateMe).toHaveBeenCalledTimes(1);
  });
});

describe('custom-theme token vocabulary', () => {
  it('mirrors the 53-token count the API guard enforces', () => {
    // cross-workspace anchor: CUSTOM_THEME_TOKEN_KEYS.size === 53 on API
    expect(EDITABLE_VARS.length).toBe(53);
  });
});
