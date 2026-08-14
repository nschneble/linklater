/**
 * Direct tests for the useAppShell hook.
 *
 * AppShell.test.tsx covers hook behavior transitively via the rendered
 * component tree. These tests target useAppShell in isolation, directly
 * importing and exercising it via renderHook to give the module direct
 * test coverage.
 *
 * Dependencies are mocked at the module boundary:
 * - react-router (useLocation, useNavigate)
 * - auth/AuthContext (useAuth)
 * - theme/ThemeContext (useTheme)
 * - lib/api (updateMe)
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./theme/ThemeContext', () => ({
  useTheme: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  updateMe: vi.fn().mockResolvedValue({}),
}));

import { makeAuthContext, makeUser } from '../test/factories';
import { setShortcutsEnabled } from './lib/hooks/useShortcutsEnabled';
import { useAppShell } from './useAppShell';
import { useAuth } from './auth/AuthContext';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from './theme/ThemeContext';
import type { BaseTheme } from './theme/constants';
import type { ThemeContextValue } from './theme/ThemeContext/types';

function makeThemeContext(
  overrides: Partial<ThemeContextValue> = {},
): ThemeContextValue {
  return {
    applyServerCustomTheme: vi.fn(() => undefined),
    applyServerCustomThemeEnabled: vi.fn(() => undefined),
    applyServerMode: vi.fn(() => undefined),
    applyServerTheme: vi.fn(() => undefined),
    baseTheme: 'scanner-darkly',
    customTheme: null,
    customThemeEnabled: false,
    disableCvdMode: vi.fn((): BaseTheme => 'scanner-darkly'),
    disableDyslexicFont: vi.fn(() => undefined),
    enableCvdMode: vi.fn((): BaseTheme => 'scanner-darkly'),
    enableDyslexicFont: vi.fn(() => undefined),
    isCvdMode: false,
    isDyslexicFont: false,
    mode: 'dark',
    setBaseTheme: vi.fn(() => undefined),
    setCustomTheme: vi.fn(() => undefined),
    setCustomThemeEnabled: vi.fn(() => undefined),
    setMode: vi.fn(() => undefined),
    setPreviewTheme: vi.fn(() => undefined),
    toggleMode: vi.fn(() => undefined),
    ...overrides,
  };
}

const navigateMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext({ user: makeUser() }));
  vi.mocked(useTheme).mockReturnValue(makeThemeContext());
  vi.mocked(useLocation).mockReturnValue({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  });
  vi.mocked(useNavigate).mockReturnValue(navigateMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('view derived from pathname', () => {
  it('resolves "/" to the links view', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.view).toBe('links');
  });

  it('resolves "/settings" to the settings view', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/settings',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.view).toBe('settings');
  });

  it('resolves "/editor" to the theme-editor view', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/editor',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.view).toBe('theme-editor');
  });

  it('resolves an unknown path to the links view', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/some-unknown-path',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.view).toBe('links');
  });
});

describe('main landmark label tracks the active view', () => {
  it('labels the links view "Your links"', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.mainLabel).toBe('Your links');
  });

  it('labels the settings view "Settings"', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/settings',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.mainLabel).toBe('Settings');
  });

  it('labels the theme-editor view "Theme editor"', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/editor',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.mainLabel).toBe('Theme editor');
  });
});

describe('user menu toggle', () => {
  it('opens the user menu when toggled from closed', () => {
    const { result } = renderHook(() => useAppShell());

    expect(result.current.showUserMenu).toBe(false);

    act(() => {
      result.current.handleUserMenuToggle();
    });

    expect(result.current.showUserMenu).toBe(true);
  });

  it('closes the user menu when toggled from open', () => {
    const { result } = renderHook(() => useAppShell());

    act(() => {
      result.current.handleUserMenuToggle();
    });
    act(() => {
      result.current.handleUserMenuToggle();
    });

    expect(result.current.showUserMenu).toBe(false);
  });

  it('closes the user menu via handleUserMenuClose', () => {
    const { result } = renderHook(() => useAppShell());

    act(() => {
      result.current.handleUserMenuToggle();
    });
    expect(result.current.showUserMenu).toBe(true);

    act(() => {
      result.current.handleUserMenuClose();
    });

    expect(result.current.showUserMenu).toBe(false);
  });
});

describe('save-link dialog open state (drives AppShell chrome inerting)', () => {
  it('defaults to closed', () => {
    const { result } = renderHook(() => useAppShell());

    expect(result.current.isSaveLinkDialogOpen).toBe(false);
  });

  it('opens when handleLinkFormOpenChange is called with true', () => {
    const { result } = renderHook(() => useAppShell());

    act(() => {
      result.current.handleLinkFormOpenChange(true);
    });

    expect(result.current.isSaveLinkDialogOpen).toBe(true);
  });

  it('closes when handleLinkFormOpenChange is called with false', () => {
    const { result } = renderHook(() => useAppShell());

    act(() => {
      result.current.handleLinkFormOpenChange(true);
    });
    expect(result.current.isSaveLinkDialogOpen).toBe(true);

    act(() => {
      result.current.handleLinkFormOpenChange(false);
    });

    expect(result.current.isSaveLinkDialogOpen).toBe(false);
  });
});

describe('global x shortcut respects the keyboard-shortcuts preference', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  function renderWithMenuTrigger() {
    const trigger = document.createElement('button');
    trigger.setAttribute('data-usermenu-trigger', '');
    const clickSpy = vi.spyOn(trigger, 'click');
    document.body.appendChild(trigger);
    renderHook(() => useAppShell());
    return {
      clickSpy,
      cleanup: () => document.body.removeChild(trigger),
    };
  }

  function fireX() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'x', bubbles: true }),
    );
  }

  it('opens the user menu when shortcuts are enabled', () => {
    const { clickSpy, cleanup } = renderWithMenuTrigger();

    act(() => fireX());

    expect(clickSpy).toHaveBeenCalledOnce();
    cleanup();
  });

  it('does nothing when shortcuts are disabled', () => {
    act(() => setShortcutsEnabled(false));
    const { clickSpy, cleanup } = renderWithMenuTrigger();

    act(() => fireX());

    expect(clickSpy).not.toHaveBeenCalled();
    cleanup();
  });
});
