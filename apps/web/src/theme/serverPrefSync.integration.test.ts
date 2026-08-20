/*
 * Mounts the real useThemeState against the real
 * useServerBooleanPrefSync, wired as App.tsx wires them. Each hook's own
 * suite runs it against a mock of the other, so the sync's decision to
 * revert a just-made local toggle is a seam neither can see. Folding
 * these cases back into either unit suite is what re-opens it.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CVD_BASE_THEME } from './constants';
import {
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  DYSLEXIC_FONT_KEY,
  DYSLEXIC_FONT_UPDATED_AT_KEY,
  writeLocalStorage,
} from './storage';
import { useServerBooleanPrefSync } from './useServerBooleanPrefSync';
import { useThemeState } from './ThemeContext/useThemeState';
import { withRefusedStorage } from '../../test/refusedStorage';

interface HarnessProps {
  serverCvdMode?: boolean;
  serverDyslexicFont?: boolean;
}

function useServerPrefSyncHarness({
  serverCvdMode,
  serverDyslexicFont,
}: HarnessProps) {
  const theme = useThemeState();

  useServerBooleanPrefSync(
    serverCvdMode,
    theme.isCvdMode,
    theme.enableCvdMode,
    theme.disableCvdMode,
    { updatedAtKey: CVD_UPDATED_AT_KEY, valueKey: CVD_MODE_KEY },
  );
  useServerBooleanPrefSync(
    serverDyslexicFont,
    theme.isDyslexicFont,
    theme.enableDyslexicFont,
    theme.disableDyslexicFont,
    { updatedAtKey: DYSLEXIC_FONT_UPDATED_AT_KEY, valueKey: DYSLEXIC_FONT_KEY },
  );

  return theme;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('server preference sync against live theme state', () => {
  it('turns CVD on through the real setter when the server says on', () => {
    const { result } = renderHook(useServerPrefSyncHarness, {
      initialProps: { serverCvdMode: true },
    });

    expect(result.current.isCvdMode).toBe(true);
    expect(result.current.baseTheme).toBe(CVD_BASE_THEME);
  });

  it('keeps CVD on when the store refuses the toggle write', () => {
    const { result } = renderHook(useServerPrefSyncHarness, {
      initialProps: { serverCvdMode: false },
    });

    withRefusedStorage(
      'setItem',
      () => {
        act(() => {
          result.current.enableCvdMode();
        });
      },
      'localStorage',
    );

    expect(result.current.isCvdMode).toBe(true);
    expect(result.current.baseTheme).toBe(CVD_BASE_THEME);
  });

  it('keeps CVD on when the store refuses reads', () => {
    const { result } = renderHook(useServerPrefSyncHarness, {
      initialProps: { serverCvdMode: false },
    });

    withRefusedStorage(
      'getItem',
      () => {
        act(() => {
          result.current.enableCvdMode();
        });
      },
      'localStorage',
    );

    expect(result.current.isCvdMode).toBe(true);
    expect(result.current.baseTheme).toBe(CVD_BASE_THEME);
  });

  it('still turns the dyslexic font off when the stored value reads off', () => {
    writeLocalStorage(DYSLEXIC_FONT_KEY, 'on');
    const { rerender, result } = renderHook(useServerPrefSyncHarness, {
      initialProps: {},
    });
    expect(result.current.isDyslexicFont).toBe(true);

    window.localStorage.setItem(DYSLEXIC_FONT_KEY, 'off');
    rerender({ serverDyslexicFont: false });

    expect(result.current.isDyslexicFont).toBe(false);
  });

  it('keeps CVD on when a refused write leaves a stale off behind', () => {
    window.localStorage.setItem(CVD_MODE_KEY, 'off');
    window.localStorage.setItem(CVD_UPDATED_AT_KEY, '1');
    const { result } = renderHook(useServerPrefSyncHarness, {
      initialProps: { serverCvdMode: false },
    });

    withRefusedStorage(
      'setItem',
      () => {
        act(() => {
          result.current.enableCvdMode();
        });
      },
      'localStorage',
    );

    expect(result.current.isCvdMode).toBe(true);
  });

  it('still turns CVD off when the stored value reads off', () => {
    // the writer clears any refusal an earlier case left on this key
    writeLocalStorage(CVD_MODE_KEY, 'on');
    const { rerender, result } = renderHook(useServerPrefSyncHarness, {
      initialProps: {},
    });
    expect(result.current.isCvdMode).toBe(true);

    window.localStorage.setItem(CVD_MODE_KEY, 'off');
    rerender({ serverCvdMode: false });

    expect(result.current.isCvdMode).toBe(false);
  });
});
