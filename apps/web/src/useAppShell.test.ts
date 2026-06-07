/**
 * Direct tests for the useAppShell hook.
 *
 * AppShell.test.tsx covers hook behavior transitively via the rendered
 * component tree. These tests target useAppShell in isolation, directly
 * importing and exercising it via renderHook to give the module direct
 * test coverage.
 *
 * Dependencies are mocked at the module boundary:
 * - react-router-dom (useLocation, useNavigate)
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

vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  updateMe: vi.fn().mockResolvedValue({}),
}));

import { useAuth } from './auth/AuthContext';
import { useTheme } from './theme/ThemeContext';
import { useAppShell } from './useAppShell';
import { useLocation, useNavigate } from 'react-router-dom';

function makeUser(overrides = {}) {
  return {
    cvdMode: false,
    connectedProviders: [],
    email: 'user@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00Z',
    hasPassword: true,
    mode: 'light' as const,
    pendingEmail: null,
    theme: 'scanner-darkly',
    multiFactorMethod: null,
    multiFactorPending: false,
    userId: 'user-1',
    welcomedAt: null,
    ...overrides,
  };
}

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    markWelcomed: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: makeUser(),
    ...overrides,
  };
}

function makeThemeContext(overrides = {}) {
  return {
    applyServerMode: vi.fn(),
    applyServerTheme: vi.fn(),
    baseTheme: 'scanner-darkly' as const,
    disableCvdMode: vi.fn(),
    enableCvdMode: vi.fn(),
    isCvdMode: false,
    mode: 'dark' as const,
    setBaseTheme: vi.fn(),
    setMode: vi.fn(),
    toggleMode: vi.fn(),
    ...overrides,
  };
}

const navigateMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
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

  it('resolves "/settings/api" to the api-docs view', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/settings/api',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });

    const { result } = renderHook(() => useAppShell());

    expect(result.current.view).toBe('api-docs');
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
