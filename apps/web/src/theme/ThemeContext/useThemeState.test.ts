/**
 * Direct tests for the useThemeState hook.
 *
 * ThemeContext.test.tsx covers end-to-end provider behavior through the
 * ThemeProvider + useTheme tree. These tests target useThemeState in
 * isolation to give the hook direct coverage, satisfying the test_coverage
 * detector which only counts direct imports.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_THEME_STORAGE_KEY,
  CUSTOM_THEME_UPDATED_AT_KEY,
} from '../storage';
import { useThemeState } from './useThemeState';

const storage: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  },
  get length() {
    return Object.keys(storage).length;
  },
  key: (index: number) => Object.keys(storage)[index] ?? null,
};

beforeEach(() => {
  localStorageMock.clear();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  delete document.documentElement.dataset.cvd;
  document.documentElement.dataset.theme = 'scanner-darkly';
  document.documentElement.dataset.mode = 'dark';
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  delete document.documentElement.dataset.cvd;
});

describe('initial state', () => {
  it('defaults baseTheme to scanner-darkly when no theme is stored', () => {
    const { result } = renderHook(() => useThemeState());
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('defaults isCvdMode to false when cvd_mode is not set', () => {
    const { result } = renderHook(() => useThemeState());
    expect(result.current.isCvdMode).toBe(false);
  });

  it('initialises isCvdMode to true when cvd_mode is "on" in storage', () => {
    window.localStorage.setItem('linklater_cvd_mode', 'on');
    const { result } = renderHook(() => useThemeState());
    expect(result.current.isCvdMode).toBe(true);
  });
});

describe('setBaseTheme', () => {
  it('updates baseTheme and persists to localStorage', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setBaseTheme('boyhood');
    });

    expect(result.current.baseTheme).toBe('boyhood');
    expect(window.localStorage.getItem('linklater_theme')).toBe('boyhood');
  });

  it('clears CVD mode when switching away from apollo theme', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });
    expect(result.current.isCvdMode).toBe(true);

    act(() => {
      result.current.setBaseTheme('boyhood');
    });

    expect(result.current.isCvdMode).toBe(false);
    expect(window.localStorage.getItem('linklater_cvd_mode')).toBe('off');
  });

  it('keeps CVD mode when setting theme to apollo while CVD is on', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      result.current.setBaseTheme('apollo-10-1-2');
    });

    expect(result.current.isCvdMode).toBe(true);
  });
});

describe('setMode', () => {
  it('updates mode and persists to localStorage', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setMode('light');
    });

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem('linklater_mode')).toBe('light');
  });
});

describe('toggleMode', () => {
  it('toggles from dark to light', () => {
    window.localStorage.setItem('linklater_mode', 'dark');
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe('light');
  });

  it('toggles from light to dark', () => {
    window.localStorage.setItem('linklater_mode', 'light');
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe('dark');
  });
});

describe('applyServerTheme', () => {
  it('does not update when a local change was made recently', () => {
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      'linklater_theme_updated_at',
      Date.now().toString(),
    );

    act(() => {
      result.current.applyServerTheme('boyhood');
    });

    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('applies the update when the local change is stale', () => {
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      'linklater_theme_updated_at',
      (Date.now() - 60_000).toString(),
    );

    act(() => {
      result.current.applyServerTheme('boyhood');
    });

    expect(result.current.baseTheme).toBe('boyhood');
  });
});

describe('applyServerMode', () => {
  it('does not update when a local mode change was made recently', () => {
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      'linklater_mode_updated_at',
      Date.now().toString(),
    );

    act(() => {
      result.current.applyServerMode('light');
    });

    // default mode is dark (no matchMedia stub → dark fallback)
    expect(result.current.mode).toBe('dark');
  });

  it('applies the server mode when the local change is stale', () => {
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      'linklater_mode_updated_at',
      (Date.now() - 60_000).toString(),
    );

    act(() => {
      result.current.applyServerMode('light');
    });

    expect(result.current.mode).toBe('light');
  });
});

describe('enableCvdMode', () => {
  it('switches baseTheme to apollo-10-1-2', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });

    expect(result.current.baseTheme).toBe('apollo-10-1-2');
  });

  it('saves the previous theme under the pre-cvd key', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setBaseTheme('boyhood');
    });
    act(() => {
      result.current.enableCvdMode();
    });

    expect(window.localStorage.getItem('linklater_pre_cvd_theme')).toBe(
      'boyhood',
    );
  });

  it('sets data-cvd="on" on the document root', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });

    expect(document.documentElement.dataset.cvd).toBe('on');
  });

  it('returns apollo-10-1-2 as the activated theme', () => {
    const { result } = renderHook(() => useThemeState());
    let returned: string | undefined;

    act(() => {
      returned = result.current.enableCvdMode();
    });

    expect(returned).toBe('apollo-10-1-2');
  });
});

describe('disableCvdMode', () => {
  it('restores the pre-cvd theme from storage', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setBaseTheme('before-sunrise');
    });
    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      result.current.disableCvdMode();
    });

    expect(result.current.baseTheme).toBe('before-sunrise');
  });

  it('falls back to scanner-darkly when the pre-cvd key is absent', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });
    window.localStorage.removeItem('linklater_pre_cvd_theme');
    act(() => {
      result.current.disableCvdMode();
    });

    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('falls back to scanner-darkly when the pre-cvd key holds an invalid value', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });
    window.localStorage.setItem('linklater_pre_cvd_theme', 'not-a-theme');
    act(() => {
      result.current.disableCvdMode();
    });

    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('removes the data-cvd attribute from the document root', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      result.current.disableCvdMode();
    });

    expect(document.documentElement.dataset.cvd).toBeUndefined();
  });

  it('returns the restored theme', () => {
    const { result } = renderHook(() => useThemeState());
    let returned: string | undefined;

    act(() => {
      result.current.setBaseTheme('school-of-rock');
    });
    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      returned = result.current.disableCvdMode();
    });

    expect(returned).toBe('school-of-rock');
  });
});

const root = () => document.documentElement;

function seedStoredCustomTheme(theme: {
  dark?: Record<string, string>;
  light?: Record<string, string>;
}) {
  window.localStorage.setItem(
    CUSTOM_THEME_STORAGE_KEY,
    JSON.stringify({ dark: theme.dark ?? {}, light: theme.light ?? {} }),
  );
}

describe('custom theme runtime injection', () => {
  it('injects tokens onto documentElement only when baseTheme is custom', () => {
    seedStoredCustomTheme({ dark: { '--mount-border': '#abcabc' } });

    // Not custom yet (defaults to scanner-darkly): nothing injected.
    const { result } = renderHook(() => useThemeState());
    expect(root().style.getPropertyValue('--mount-border')).toBe('');

    act(() => {
      result.current.setBaseTheme('custom');
    });
    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');
  });

  it('removes every injected property when switching away from custom', () => {
    window.localStorage.setItem('linklater_theme', 'custom');
    seedStoredCustomTheme({ dark: { '--mount-border': '#abcabc' } });

    const { result } = renderHook(() => useThemeState());
    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');

    act(() => {
      result.current.setBaseTheme('boyhood');
    });
    expect(root().style.getPropertyValue('--mount-border')).toBe('');
  });

  it('re-injects the other mode and drops a token present in one mode only', () => {
    window.localStorage.setItem('linklater_theme', 'custom');
    window.localStorage.setItem('linklater_mode', 'dark');
    seedStoredCustomTheme({
      dark: { '--mount-border': '#dark11' },
      light: { '--base-bg': '#light22' },
    });

    const { result } = renderHook(() => useThemeState());
    expect(root().style.getPropertyValue('--mount-border')).toBe('#dark11');
    expect(root().style.getPropertyValue('--base-bg')).toBe('');

    act(() => {
      result.current.setMode('light');
    });
    expect(root().style.getPropertyValue('--base-bg')).toBe('#light22');
    expect(root().style.getPropertyValue('--mount-border')).toBe('');
  });

  it('injects nothing without crashing when no tokens are saved', () => {
    window.localStorage.setItem('linklater_theme', 'custom');

    expect(() => renderHook(() => useThemeState())).not.toThrow();
    expect(root().style.getPropertyValue('--mount-border')).toBe('');
  });
});

describe('setCustomTheme', () => {
  it('writes both storage keys and updates state', () => {
    const { result } = renderHook(() => useThemeState());
    const nextTheme = { dark: { '--mount-border': '#445566' }, light: {} };

    act(() => {
      result.current.setCustomTheme(nextTheme);
    });

    expect(result.current.customTheme).toEqual(nextTheme);
    expect(
      JSON.parse(window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY) ?? '{}'),
    ).toEqual(nextTheme);
    expect(
      window.localStorage.getItem(CUSTOM_THEME_UPDATED_AT_KEY),
    ).not.toBeNull();
  });
});

describe('applyServerCustomTheme', () => {
  it('suppresses when a local change was made recently', () => {
    window.localStorage.setItem('linklater_theme', 'custom');
    seedStoredCustomTheme({ dark: { '--mount-border': '#local00' } });
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      CUSTOM_THEME_UPDATED_AT_KEY,
      Date.now().toString(),
    );

    act(() => {
      result.current.applyServerCustomTheme({
        dark: { '--mount-border': '#server0' },
        light: {},
      });
    });

    expect(result.current.customTheme?.dark['--mount-border']).toBe('#local00');
  });

  it('applies and writes the server value when the guard has passed', () => {
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      CUSTOM_THEME_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );
    const serverTheme = { dark: { '--mount-border': '#server0' }, light: {} };

    act(() => {
      result.current.applyServerCustomTheme(serverTheme);
    });

    expect(result.current.customTheme).toEqual(serverTheme);
    expect(
      JSON.parse(window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY) ?? '{}'),
    ).toEqual(serverTheme);
  });

  it('removes the localStorage key when the server value is null', () => {
    seedStoredCustomTheme({ dark: { '--mount-border': '#local00' } });
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      CUSTOM_THEME_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );

    act(() => {
      result.current.applyServerCustomTheme(null);
    });

    expect(result.current.customTheme).toBeNull();
    expect(window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)).toBeNull();
  });
});
