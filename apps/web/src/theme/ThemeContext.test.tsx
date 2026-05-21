import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';
import type { ReactNode } from 'react';

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

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  // resets dataset attributes between tests
  delete document.documentElement.dataset.cvd;
  document.documentElement.dataset.theme = 'scanner-darkly';
  document.documentElement.dataset.mode = 'dark';
});

afterEach(() => {
  delete document.documentElement.dataset.cvd;
});

describe('enableCvdMode', () => {
  it('saves current theme to pre-cvd localStorage key', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
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

  it('switches baseTheme to apollo-10-1-2', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    expect(result.current.baseTheme).toBe('apollo-10-1-2');
  });

  it('sets data-cvd="on" on the document root', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    expect(document.documentElement.dataset.cvd).toBe('on');
  });
});

describe('disableCvdMode', () => {
  it('restores the pre-cvd theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
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

  it('falls back to scanner-darkly when pre-cvd key is absent', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    // simulates key being absent
    window.localStorage.removeItem('linklater_pre_cvd_theme');
    act(() => {
      result.current.disableCvdMode();
    });
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('removes the data-cvd attribute from the document root', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      result.current.disableCvdMode();
    });
    expect(document.documentElement.dataset.cvd).toBeUndefined();
  });
});

describe('setBaseTheme while cvd on', () => {
  it('clears cvd mode when picking a non-apollo theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      result.current.setBaseTheme('boyhood');
    });
    expect(result.current.isCvdMode).toBe(false);
  });

  it('keeps cvd mode when picking the apollo theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    act(() => {
      result.current.setBaseTheme('apollo-10-1-2');
    });
    expect(result.current.isCvdMode).toBe(true);
  });
});

describe('applyServerTheme', () => {
  it('skips the update if a local change was made within 30 seconds', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    // records a very recent local change
    window.localStorage.setItem(
      'linklater_theme_updated_at',
      Date.now().toString(),
    );
    act(() => {
      result.current.applyServerTheme('boyhood');
    });
    // should stay on the initial theme (scanner-darkly), not switch to boyhood
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('applies the update when the local change is older than 30 seconds', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    // records a very old local change
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

describe('getInitialBaseTheme (via ThemeProvider initial state)', () => {
  it('falls back to scanner-darkly when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });

  it('ignores an invalid stored theme and falls back to scanner-darkly', () => {
    window.localStorage.setItem('linklater_theme', 'not-a-real-theme');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });
});

describe('disableCvdMode validation guard', () => {
  it('falls back to scanner-darkly when pre-cvd key holds an invalid value', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.enableCvdMode();
    });
    // tampers with the key to hold an invalid theme
    window.localStorage.setItem('linklater_pre_cvd_theme', 'not-a-theme');
    act(() => {
      result.current.disableCvdMode();
    });
    expect(result.current.baseTheme).toBe('scanner-darkly');
  });
});

describe('ThemeProvider', () => {
  it('renders children without errors', () => {
    const { getByText } = render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );
    expect(getByText('child')).toBeInTheDocument();
  });
});
