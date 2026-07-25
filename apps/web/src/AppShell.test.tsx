/**
 * Integration test for AppShell's chrome-inerting round-trip.
 *
 * The links view's inline save-link dialog is `aria-modal`, but the Header,
 * the email-verification banner, and the skip link live OUTSIDE the dialog's
 * subtree (they are AppShell-level chrome). Before this fix a mouse/touch user
 * could click through to them and an SR browse-mode user could reach them
 * while the dialog claimed to trap focus (WCAG 2.4.3 / 4.1.2).
 *
 * AppShell now `inert`s all three whenever LinksView reports its dialog open
 * (via `onLinkFormOpenChange`, plumbed through `useAppShell`). This test drives
 * that report from a stubbed LinksView and asserts the chrome flips inert on
 * open and back to interactive on close.
 *
 * `Header` is stubbed to a bare `<header>` that reflects its `inert` prop; the
 * real Header's application of `inert` to its root element is covered in
 * `Header.test.tsx`. The heavy view/modal children are stubbed so this test
 * exercises only AppShell's own wiring. `useAppShell`'s dependencies are mocked
 * at the module boundary, mirroring `useAppShell.test.ts`.
 */

import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('./components/Header', () => ({
  default: ({ inert }: { inert?: boolean }) => (
    <header data-testid="app-header" inert={inert} />
  ),
}));

vi.mock('./components/links/LinksView', () => ({
  default: ({
    onLinkFormOpenChange,
  }: {
    onLinkFormOpenChange?: (isOpen: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onLinkFormOpenChange?.(true)}>
        open save-link dialog
      </button>
      <button type="button" onClick={() => onLinkFormOpenChange?.(false)}>
        close save-link dialog
      </button>
    </div>
  ),
}));

vi.mock('./components/settings/SettingsView', () => ({
  default: () => null,
}));

vi.mock('./components/settings/ThemeEditor', () => ({
  default: () => null,
}));

vi.mock('./components/welcome/WelcomeModal', () => ({
  default: () => null,
}));

import AppShell from './AppShell';
import { useAuth } from './auth/AuthContext';
import { useTheme } from './theme/ThemeContext';
import { useLocation, useNavigate } from 'react-router';

function makeUser(overrides = {}) {
  return {
    connectedProviders: [],
    cvdMode: false,
    dyslexicFont: false,
    email: 'user@example.com',
    // Unverified so the AppShell verification banner renders.
    emailVerifiedAt: null,
    hasPassword: true,
    mode: 'light' as const,
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    // Non-null so the WelcomeModal branch stays closed.
    welcomedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function skipLink() {
  return screen.getByText('Skip to main content');
}

function banner() {
  return screen.getByRole('status');
}

function header() {
  return screen.getByTestId('app-header');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    logout: vi.fn(),
    markWelcomed: vi.fn(),
    user: makeUser(),
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useTheme).mockReturnValue({
    setBaseTheme: vi.fn(),
    toggleMode: vi.fn(),
  } as unknown as ReturnType<typeof useTheme>);
  vi.mocked(useLocation).mockReturnValue({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  });
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppShell chrome inerting round-trip', () => {
  it('leaves the skip link, banner, and header interactive while the dialog is closed', () => {
    render(<AppShell />);

    expect(skipLink()).not.toHaveAttribute('inert');
    expect(banner()).not.toHaveAttribute('inert');
    expect(header()).not.toHaveAttribute('inert');
  });

  it('inerts the skip link, banner, and header when the save-link dialog opens', () => {
    render(<AppShell />);

    fireEvent.click(
      screen.getByRole('button', { name: 'open save-link dialog' }),
    );

    expect(skipLink()).toHaveAttribute('inert');
    expect(banner()).toHaveAttribute('inert');
    expect(header()).toHaveAttribute('inert');
  });

  it('restores the chrome to interactive when the dialog closes', () => {
    render(<AppShell />);

    fireEvent.click(
      screen.getByRole('button', { name: 'open save-link dialog' }),
    );
    expect(header()).toHaveAttribute('inert');

    fireEvent.click(
      screen.getByRole('button', { name: 'close save-link dialog' }),
    );

    expect(skipLink()).not.toHaveAttribute('inert');
    expect(banner()).not.toHaveAttribute('inert');
    expect(header()).not.toHaveAttribute('inert');
  });
});
