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
  BRANDING_DEFAULTS,
  BRANDING_DEFAULTS_LIGHT,
} from '../brandingDefaults';
import {
  CUSTOM_THEME_ENABLED_KEY,
  CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  CUSTOM_THEME_UPDATED_AT_KEY,
  LAST_SEEN_SYSTEM_MODE_KEY,
  MODE_STORAGE_KEY,
  MODE_UPDATED_AT_KEY,
  THEME_STORAGE_KEY,
} from '../storage';
import { CUSTOM_TOKEN_KEYS } from '../customTheme';
import { getSystemMode } from '../systemMode';
import {
  restoreSystemColorScheme,
  stubSystemColorScheme,
} from '../../../test/systemColorScheme';
import { useThemeState } from './useThemeState';
import { withRefusedStorage } from '../../../test/refusedStorage';

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
  delete document.documentElement.dataset.dyslexicFont;
  document.documentElement.dataset.theme = 'scanner-darkly';
  document.documentElement.dataset.mode = 'dark';
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  delete document.documentElement.dataset.cvd;
  delete document.documentElement.dataset.dyslexicFont;
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

  it('defaults isDyslexicFont to false when dyslexic_font is not set', () => {
    const { result } = renderHook(() => useThemeState());
    expect(result.current.isDyslexicFont).toBe(false);
  });

  it('initialises isDyslexicFont to true when dyslexic_font is "on" in storage', () => {
    window.localStorage.setItem('linklater_dyslexic_font', 'on');
    const { result } = renderHook(() => useThemeState());
    expect(result.current.isDyslexicFont).toBe(true);
  });

  it('sets data-dyslexic-font="on" on mount when dyslexic_font is stored "on"', () => {
    window.localStorage.setItem('linklater_dyslexic_font', 'on');
    renderHook(() => useThemeState());
    expect(document.documentElement.dataset.dyslexicFont).toBe('on');
    expect(document.documentElement.getAttribute('data-dyslexic-font')).toBe(
      'on',
    );
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

  it('still clears CVD mode when the store refuses the write', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });

    expect(() =>
      withRefusedStorage(
        'setItem',
        () => {
          act(() => {
            result.current.setBaseTheme('boyhood');
          });
        },
        'localStorage',
      ),
    ).not.toThrow();
    expect(result.current.isCvdMode).toBe(false);
    expect(result.current.baseTheme).toBe('boyhood');
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
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('boyhood');
  });

  it('still applies the server theme when the store refuses the write', () => {
    const { result } = renderHook(() => useThemeState());

    withRefusedStorage(
      'setItem',
      () => {
        act(() => {
          result.current.applyServerTheme('boyhood');
        });
      },
      'localStorage',
    );

    expect(result.current.baseTheme).toBe('boyhood');
  });
});

describe('applyServerMode', () => {
  // stored light vs the dark matchMedia fallback: a choice, not the system
  it('does not update when a local mode change was made recently', () => {
    window.localStorage.setItem(MODE_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(MODE_UPDATED_AT_KEY, Date.now().toString());

    act(() => {
      result.current.applyServerMode('dark');
    });

    expect(result.current.mode).toBe('light');
  });

  it('applies the server mode when the local change is stale', () => {
    window.localStorage.setItem(MODE_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      MODE_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );

    act(() => {
      result.current.applyServerMode('dark');
    });

    expect(result.current.mode).toBe('dark');
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

  it('does not throw when the store refuses the pre-cvd write', () => {
    const { result } = renderHook(() => useThemeState());

    expect(() =>
      withRefusedStorage(
        'setItem',
        () => {
          act(() => {
            result.current.enableCvdMode();
          });
        },
        'localStorage',
      ),
    ).not.toThrow();
  });

  // the refused write is the first statement, so all of this is at stake
  it('still turns CVD on when the store refuses the pre-cvd write', () => {
    const { result } = renderHook(() => useThemeState());

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
    expect(result.current.baseTheme).toBe('apollo-10-1-2');
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

  it('does not throw when the store refuses the pre-cvd removal', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableCvdMode();
    });

    expect(() =>
      withRefusedStorage(
        'removeItem',
        () => {
          act(() => {
            result.current.disableCvdMode();
          });
        },
        'localStorage',
      ),
    ).not.toThrow();
  });

  it('still clears CVD and returns the previous theme when the removal is refused', () => {
    const { result } = renderHook(() => useThemeState());
    let returned: string | undefined;

    act(() => {
      result.current.setBaseTheme('boyhood');
    });
    act(() => {
      result.current.enableCvdMode();
    });

    withRefusedStorage(
      'removeItem',
      () => {
        act(() => {
          returned = result.current.disableCvdMode();
        });
      },
      'localStorage',
    );

    expect(returned).toBe('boyhood');
    expect(result.current.isCvdMode).toBe(false);
  });
});

describe('enableDyslexicFont', () => {
  it('sets isDyslexicFont true and data-dyslexic-font="on"', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableDyslexicFont();
    });

    expect(result.current.isDyslexicFont).toBe(true);
    expect(document.documentElement.dataset.dyslexicFont).toBe('on');
    expect(document.documentElement.getAttribute('data-dyslexic-font')).toBe(
      'on',
    );
  });

  it('persists the flag and a timestamp to localStorage', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableDyslexicFont();
    });

    expect(window.localStorage.getItem('linklater_dyslexic_font')).toBe('on');
    expect(
      window.localStorage.getItem('linklater_dyslexic_font_updated_at'),
    ).not.toBeNull();
  });

  it('does not switch the active base theme', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setBaseTheme('boyhood');
    });
    act(() => {
      result.current.enableDyslexicFont();
    });

    expect(result.current.baseTheme).toBe('boyhood');
  });

  it('still enables the font when the store refuses the write', () => {
    const { result } = renderHook(() => useThemeState());

    expect(() =>
      withRefusedStorage(
        'setItem',
        () => {
          act(() => {
            result.current.enableDyslexicFont();
          });
        },
        'localStorage',
      ),
    ).not.toThrow();
    expect(result.current.isDyslexicFont).toBe(true);
  });
});

describe('disableDyslexicFont', () => {
  it('sets isDyslexicFont false and removes the data-dyslexic-font attribute', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableDyslexicFont();
    });
    expect(document.documentElement.dataset.dyslexicFont).toBe('on');

    act(() => {
      result.current.disableDyslexicFont();
    });

    expect(result.current.isDyslexicFont).toBe(false);
    expect(document.documentElement.dataset.dyslexicFont).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-dyslexic-font')).toBe(
      false,
    );
  });

  it('persists the off flag and a timestamp to localStorage', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableDyslexicFont();
    });
    act(() => {
      result.current.disableDyslexicFont();
    });

    expect(window.localStorage.getItem('linklater_dyslexic_font')).toBe('off');
    expect(
      window.localStorage.getItem('linklater_dyslexic_font_updated_at'),
    ).not.toBeNull();
  });

  it('does not restore or change the active base theme', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.setBaseTheme('boyhood');
    });
    act(() => {
      result.current.enableDyslexicFont();
    });
    act(() => {
      result.current.disableDyslexicFont();
    });

    expect(result.current.baseTheme).toBe('boyhood');
  });

  it('still disables the font when the store refuses the write', () => {
    const { result } = renderHook(() => useThemeState());

    act(() => {
      result.current.enableDyslexicFont();
    });

    expect(() =>
      withRefusedStorage(
        'setItem',
        () => {
          act(() => {
            result.current.disableDyslexicFont();
          });
        },
        'localStorage',
      ),
    ).not.toThrow();
    expect(result.current.isDyslexicFont).toBe(false);
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

    // not custom yet (defaults to scanner-darkly): nothing injected
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

  it('re-injects the other mode and falls back to branding for an unsaved dark token', () => {
    window.localStorage.setItem('linklater_theme', 'custom');
    window.localStorage.setItem('linklater_mode', 'dark');
    seedStoredCustomTheme({
      dark: { '--mount-border': '#dark11' },
      light: { '--base-bg': '#light22' },
    });

    const { result } = renderHook(() => useThemeState());
    // saved dark token wins; an unsaved dark token falls back to branding
    expect(root().style.getPropertyValue('--mount-border')).toBe('#dark11');
    expect(root().style.getPropertyValue('--base-bg')).toBe(
      BRANDING_DEFAULTS['--base-bg'],
    );

    act(() => {
      result.current.setMode('light');
    });
    // light defaults to branding-light: saved token wins, unsaved falls back
    expect(root().style.getPropertyValue('--base-bg')).toBe('#light22');
    expect(root().style.getPropertyValue('--mount-border')).toBe(
      BRANDING_DEFAULTS_LIGHT['--mount-border'],
    );
  });

  it('defaults the dark palette to branding when no tokens are saved', () => {
    window.localStorage.setItem('linklater_theme', 'custom');
    window.localStorage.setItem('linklater_mode', 'dark');

    expect(() => renderHook(() => useThemeState())).not.toThrow();
    expect(root().style.getPropertyValue('--mount-border')).toBe(
      BRANDING_DEFAULTS['--mount-border'],
    );
    expect(root().style.getPropertyValue('--base-bg')).toBe(
      BRANDING_DEFAULTS['--base-bg'],
    );
  });

  it('defaults the light palette to branding-light when no tokens are saved', () => {
    window.localStorage.setItem('linklater_theme', 'custom');
    window.localStorage.setItem('linklater_mode', 'light');

    expect(() => renderHook(() => useThemeState())).not.toThrow();
    expect(root().style.getPropertyValue('--mount-border')).toBe(
      BRANDING_DEFAULTS_LIGHT['--mount-border'],
    );
    expect(root().style.getPropertyValue('--base-bg')).toBe(
      BRANDING_DEFAULTS_LIGHT['--base-bg'],
    );
  });
});

describe('unauthenticated branding gate', () => {
  it('paints branding and injects no tokens even when the stored theme is custom', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'custom');
    seedStoredCustomTheme({
      dark: { '--mount-border': '#ff0000', '--base-bg': '#010203' },
    });

    const { result } = renderHook(() => useThemeState(false));

    // auth screens paint off-book branding, ignoring the stored theme
    expect(root().dataset.theme).toBe('branding');
    // branding wins BEFORE the `=== 'custom'` gate, so no palette is injected
    for (const variable of CUSTOM_TOKEN_KEYS) {
      expect(root().style.getPropertyValue(variable)).toBe('');
    }
    // the stored selection is left untouched so it restores after login
    expect(result.current.baseTheme).toBe('custom');
  });

  it('paints branding over a stored film theme too', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'boyhood');

    const { result } = renderHook(() => useThemeState(false));

    expect(root().dataset.theme).toBe('branding');
    expect(result.current.baseTheme).toBe('boyhood');
  });

  it('paints the stored theme and injects the custom palette when authenticated', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'custom');
    seedStoredCustomTheme({ dark: { '--mount-border': '#abcabc' } });

    const { result } = renderHook(() => useThemeState(true));

    expect(result.current.baseTheme).toBe('custom');
    expect(root().dataset.theme).toBe('custom');
    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');
  });
});

describe('setCustomThemeEnabled', () => {
  it('writes the flag + timestamp and updates state', () => {
    const { result } = renderHook(() => useThemeState());
    expect(result.current.customThemeEnabled).toBe(false);

    act(() => {
      result.current.setCustomThemeEnabled(true);
    });

    expect(result.current.customThemeEnabled).toBe(true);
    expect(window.localStorage.getItem(CUSTOM_THEME_ENABLED_KEY)).toBe('on');
    expect(
      window.localStorage.getItem(CUSTOM_THEME_ENABLED_UPDATED_AT_KEY),
    ).not.toBeNull();
  });

  it('initialises from the stored flag', () => {
    window.localStorage.setItem(CUSTOM_THEME_ENABLED_KEY, 'on');
    const { result } = renderHook(() => useThemeState());
    expect(result.current.customThemeEnabled).toBe(true);
  });
});

describe('applyServerCustomThemeEnabled', () => {
  it('suppresses when toggled locally within the guard window', () => {
    window.localStorage.setItem(CUSTOM_THEME_ENABLED_KEY, 'on');
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
      Date.now().toString(),
    );

    act(() => {
      result.current.applyServerCustomThemeEnabled(false);
    });

    expect(result.current.customThemeEnabled).toBe(true);
  });

  it('applies the server value once the guard has passed', () => {
    const { result } = renderHook(() => useThemeState());
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );

    act(() => {
      result.current.applyServerCustomThemeEnabled(true);
    });

    expect(result.current.customThemeEnabled).toBe(true);
    expect(window.localStorage.getItem(CUSTOM_THEME_ENABLED_KEY)).toBe('on');
  });

  it('still applies the server value when the store refuses the write', () => {
    const { result } = renderHook(() => useThemeState());

    withRefusedStorage(
      'setItem',
      () => {
        act(() => {
          result.current.applyServerCustomThemeEnabled(true);
        });
      },
      'localStorage',
    );

    expect(result.current.customThemeEnabled).toBe(true);
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

  it('still applies the server palette when the store refuses the write', () => {
    const { result } = renderHook(() => useThemeState());
    const serverTheme = { dark: { '--mount-border': '#server0' }, light: {} };

    withRefusedStorage(
      'setItem',
      () => {
        act(() => {
          result.current.applyServerCustomTheme(serverTheme);
        });
      },
      'localStorage',
    );

    expect(result.current.customTheme).toEqual(serverTheme);
  });

  it('still clears the custom theme when the store refuses the removal', () => {
    seedStoredCustomTheme({ dark: { '--mount-border': '#local00' } });
    const { result } = renderHook(() => useThemeState());

    withRefusedStorage(
      'removeItem',
      () => {
        act(() => {
          result.current.applyServerCustomTheme(null);
        });
      },
      'localStorage',
    );

    expect(result.current.customTheme).toBeNull();
  });
});

describe('setPreviewTheme', () => {
  it('paints the preview theme on data-theme without changing baseTheme or storage', () => {
    const { result } = renderHook(() => useThemeState());
    expect(result.current.baseTheme).toBe('scanner-darkly');

    act(() => {
      result.current.setPreviewTheme('boyhood');
    });

    expect(root().dataset.theme).toBe('boyhood');
    // committed selection and storage untouched; preview never persists
    expect(result.current.baseTheme).toBe('scanner-darkly');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('reverts to the committed theme when the preview is cleared', () => {
    const { result } = renderHook(() => useThemeState());
    act(() => result.current.setPreviewTheme('boyhood'));
    expect(root().dataset.theme).toBe('boyhood');

    act(() => result.current.setPreviewTheme(null));
    expect(root().dataset.theme).toBe('scanner-darkly');
  });

  it('injects custom tokens when previewing custom and clears them when previewing away', () => {
    seedStoredCustomTheme({ dark: { '--mount-border': '#abcabc' } });
    // baseTheme stays a film theme; only the preview points at custom.
    const { result } = renderHook(() => useThemeState());
    expect(root().style.getPropertyValue('--mount-border')).toBe('');

    act(() => result.current.setPreviewTheme('custom'));
    expect(root().style.getPropertyValue('--mount-border')).toBe('#abcabc');

    act(() => result.current.setPreviewTheme('boyhood'));
    expect(root().style.getPropertyValue('--mount-border')).toBe('');
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('does not let a preview of custom bypass the unauthenticated gate', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'custom');
    seedStoredCustomTheme({ dark: { '--mount-border': '#abcabc' } });
    // unauthenticated: branding short-circuits paint, blocking custom inject
    const { result } = renderHook(() => useThemeState(false));

    act(() => result.current.setPreviewTheme('custom'));

    expect(root().dataset.theme).not.toBe('custom');
    expect(root().style.getPropertyValue('--mount-border')).toBe('');
  });
});

describe('system mode', () => {
  afterEach(restoreSystemColorScheme);

  it('follows the OS when the stored mode already matches it', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useThemeState());

    act(() => system.flip('light'));

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.mode).toBe('light');
  });

  it('paints the stored mode when it differs from the OS', () => {
    stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'light');

    const { result } = renderHook(() => useThemeState());

    expect(result.current.mode).toBe('light');
    expect(document.documentElement.dataset.mode).toBe('light');
  });

  it('collapses a choice back into following the system', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useThemeState());

    act(() => result.current.setMode('light'));
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
    expect(getSystemMode()).toBe('dark');

    act(() => system.flip('light'));
    expect(result.current.mode).toBe('light');

    act(() => system.flip('dark'));

    expect(result.current.mode).toBe('dark');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark');
  });

  it('keeps the adopted OS value across a remount', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    const first = renderHook(() => useThemeState());

    act(() => system.flip('light'));
    first.unmount();

    const { result } = renderHook(() => useThemeState());
    expect(result.current.mode).toBe('light');
  });

  it('does not write the OS-driven mode timestamp', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useThemeState());

    act(() => system.flip('light'));

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(MODE_UPDATED_AT_KEY)).toBeNull();
  });

  it('ignores the server mode while the device follows the system', () => {
    stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    window.localStorage.setItem(
      MODE_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );
    const { result } = renderHook(() => useThemeState());

    act(() => result.current.applyServerMode('light'));

    expect(result.current.mode).toBe('dark');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark');
  });

  it('applies the server mode while the device is on a choice', () => {
    stubSystemColorScheme('light');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    window.localStorage.setItem(
      MODE_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );
    const { result } = renderHook(() => useThemeState());

    act(() => result.current.applyServerMode('light'));

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
  });

  it('ignores the server mode after the OS drove an adoption', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    window.localStorage.setItem(
      MODE_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );
    const { result } = renderHook(() => useThemeState());

    act(() => system.flip('light'));
    act(() => result.current.applyServerMode('dark'));

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
  });

  it('records the OS value and the mode it painted at mount', () => {
    stubSystemColorScheme('light');

    renderHook(() => useThemeState());

    expect(window.localStorage.getItem(LAST_SEEN_SYSTEM_MODE_KEY)).toBe(
      'light',
    );
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
    expect(window.localStorage.getItem(MODE_UPDATED_AT_KEY)).toBeNull();
  });

  it('records the OS value this boot read, not a second reading', () => {
    let readCount = 0;
    const lightQuery = {
      get matches() {
        readCount += 1;
        return readCount > 1;
      },
      media: '(prefers-color-scheme: light)',
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (media: string) =>
        media === lightQuery.media
          ? lightQuery
          : {
              matches: false,
              media,
              addEventListener() {},
              removeEventListener() {},
            },
    });

    const { result } = renderHook(() => useThemeState());

    expect(result.current.mode).toBe('dark');
    expect(window.localStorage.getItem(LAST_SEEN_SYSTEM_MODE_KEY)).toBe('dark');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark');
  });

  it('mounts without throwing when the store refuses to be written', () => {
    stubSystemColorScheme('light');

    withRefusedStorage(
      'setItem',
      () => {
        expect(() => renderHook(() => useThemeState())).not.toThrow();
      },
      'localStorage',
    );
  });

  it('records the OS value again after an adoption', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useThemeState());

    act(() => system.flip('light'));

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(LAST_SEEN_SYSTEM_MODE_KEY)).toBe(
      'light',
    );
  });

  it('adopts an OS change that landed while the tab was closed', () => {
    const system = stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    renderHook(() => useThemeState()).unmount();

    system.flip('light');
    const { result } = renderHook(() => useThemeState());

    expect(result.current.mode).toBe('light');
    expect(document.documentElement.dataset.mode).toBe('light');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
    expect(window.localStorage.getItem(MODE_UPDATED_AT_KEY)).toBeNull();
  });

  it('ignores the server mode after adopting at mount', () => {
    stubSystemColorScheme('light');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    window.localStorage.setItem(LAST_SEEN_SYSTEM_MODE_KEY, 'dark');
    const { result } = renderHook(() => useThemeState());

    act(() => result.current.applyServerMode('dark'));

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
  });

  it('keeps a chosen mode the OS has not caught up to', () => {
    stubSystemColorScheme('light');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
    window.localStorage.setItem(LAST_SEEN_SYSTEM_MODE_KEY, 'light');

    const { result } = renderHook(() => useThemeState());

    expect(result.current.mode).toBe('dark');
    expect(document.documentElement.dataset.mode).toBe('dark');
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark');
  });

  it('applies the server mode in a tab a sibling left behind', () => {
    stubSystemColorScheme('dark');
    window.localStorage.setItem(MODE_STORAGE_KEY, 'light');
    const firstTab = renderHook(() => useThemeState());
    const secondTab = renderHook(() => useThemeState());

    act(() => firstTab.result.current.toggleMode());
    window.localStorage.setItem(
      MODE_UPDATED_AT_KEY,
      (Date.now() - 60_000).toString(),
    );

    act(() => secondTab.result.current.applyServerMode('dark'));

    expect(firstTab.result.current.mode).toBe('dark');
    expect(secondTab.result.current.mode).toBe('dark');
  });
});
