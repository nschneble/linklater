/**
 * Tests for DangerZone – the account-deletion settings section.
 *
 * Two branches based on credential presence:
 *   - Credentialed: hasPassword=true → ReauthForm inline
 *   - Email-confirm: magic-link-only account → ActionGuard two-step
 *
 * State machine: idle → reauth → reauth-pending → (logout) or (reauth on error)
 *                idle → confirming → email-sent → (never-mind → idle)
 */

import DangerZone from './DangerZone';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import type { User } from '../../auth/AuthContext/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  deleteMe: vi.fn(),
  cancelPendingAccountDeletion: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    connectedProviders: [],
    cvdMode: false,
    dyslexicFont: false,
    email: 'test@example.com',
    emailVerifiedAt: null,
    hasPassword: false,
    pendingEmail: null,
    mode: 'light',
    theme: 'scanner-darkly',
    multiFactorMethod: null,
    multiFactorPending: false,
    accountDeletionPending: false,
    userId: 'user-1',
    welcomedAt: null,
    ...overrides,
  };
}

function makeAuthContext(
  overrides: Partial<{
    logout: ReturnType<typeof vi.fn>;
    user: User | null;
    loading: boolean;
  }> = {},
) {
  return {
    loading: false,
    logout: vi.fn(),
    user: makeUser(),
    login: vi.fn(),
    loginWithToken: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    resendEmailChangeVerification: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    markWelcomed: vi.fn(),
    ...overrides,
  };
}

function renderDangerZone() {
  return render(
    <MemoryRouter>
      <DangerZone />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });
  vi.mocked(apiModule.cancelPendingAccountDeletion).mockResolvedValue(
    undefined,
  );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DangerZone loading state', () => {
  it('renders a disabled trigger while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ loading: true, user: null }),
    );
    renderDangerZone();

    const button = screen.getByRole('button', { name: /delete my account/i });
    expect(button).toBeDisabled();
  });
});

describe('DangerZone credentialed branch (hasPassword: true)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ hasPassword: true }) }),
    );
  });

  it('shows the "Delete my account" trigger initially', () => {
    renderDangerZone();
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Delete my account" reveals the ReauthForm', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  // M2: ReauthForm focusOnMount lands keyboard users in the password field
  // the instant the form reveals, instead of leaving focus on the (now
  // unmounted) trigger and dropping to <body>.
  it('opening reauth autofocuses the current-password field (focusOnMount)', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(screen.getByLabelText(/current password/i)).toHaveFocus();
  });

  it('does not render the MFA code field for password-only accounts', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/authenticator or recovery code/i),
    ).not.toBeInTheDocument();
  });

  it('submitting the reauth form with a password calls deleteMe with that password', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });
    const { container } = renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.deleteMe).toHaveBeenCalledWith(
      expect.objectContaining({ currentPassword: 'secret123' }),
    );
  });

  it('successful submission calls logout', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ hasPassword: true }), logout }),
    );
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });
    const { container } = renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(logout).toHaveBeenCalled();
  });

  it('wrong password → error appears in role="alert" and phase reverts to reauth', async () => {
    vi.mocked(apiModule.deleteMe).mockRejectedValue(
      new Error('Incorrect password'),
    );
    const { container } = renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'wrong' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/incorrect password/i);
    // ReauthForm still visible – phase is 'reauth'
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('Escape key closes the reauth form', async () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(
      screen.queryByLabelText(/current password/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('cancel button closes the reauth form', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(
      screen.queryByLabelText(/current password/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  // M1: closeReauth schedules triggerReference.current?.focus() on a
  // requestAnimationFrame so focus lands after the idle trigger remounts.
  // waitFor polls past the rAF tick (real timers, jsdom rAF is a macrotask).
  it('cancel returns focus to the trigger button (rAF-scheduled)', async () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /delete my account/i }),
      ).toHaveFocus();
    });
  });

  it('Escape returns focus to the trigger button (rAF-scheduled)', async () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /delete my account/i }),
      ).toHaveFocus();
    });
  });
});

describe('DangerZone credentialed branch (MFA-only: hasPassword=false, multiFactorMethod=totp)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ hasPassword: false, multiFactorMethod: 'totp' }),
      }),
    );
  });

  it('reveals only the code field – no password input', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(
      screen.getByLabelText(/authenticator or recovery code/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/current password/i),
    ).not.toBeInTheDocument();
  });

  // M2: focusOnMount falls through to the code field when there is no
  // password input to claim focus first.
  it('opening reauth autofocuses the code field (focusOnMount)', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(
      screen.getByLabelText(/authenticator or recovery code/i),
    ).toHaveFocus();
  });

  it('submitting the reauth form with a code calls deleteMe with that code', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });
    const { container } = renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(screen.getByLabelText(/authenticator or recovery code/i), {
      target: { value: '123456' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.deleteMe).toHaveBeenCalledWith(
      expect.objectContaining({ code: '123456' }),
    );
  });
});

describe('DangerZone email-confirm branch (magic-link-only: hasPassword=false, no MFA)', () => {
  // The email-confirm branch is driven by `user.accountDeletionPending` (a
  // server-derived flag) so the panel survives navigation away from
  // Settings and back. Tests in this branch model that contract: the
  // useAuth mock is wired stateful so refreshUser actually mutates the
  // user object the component reads on re-render.
  function setupStatefulAuth(initialPending: boolean) {
    let currentUser = makeUser({
      hasPassword: false,
      multiFactorMethod: null,
      accountDeletionPending: initialPending,
    });
    let listeners: Array<() => void> = [];
    const logout = vi.fn();
    const refreshUser = vi.fn(async () => {
      // Server source of truth: a pending deletion token from deleteMe;
      // Never mind clears it via cancelPendingAccountDeletion.
      const deleteCalls = vi.mocked(apiModule.deleteMe).mock.calls.length;
      const cancelCalls = vi.mocked(apiModule.cancelPendingAccountDeletion).mock
        .calls.length;
      const pending = deleteCalls > cancelCalls;
      currentUser = { ...currentUser, accountDeletionPending: pending };
      listeners.forEach((listener) => listener());
    });
    vi.mocked(useAuth).mockImplementation(() => {
      const [, setVersion] = useState(0);
      useEffect(() => {
        const listener = () => setVersion((version) => version + 1);
        listeners.push(listener);
        return () => {
          listeners = listeners.filter((each) => each !== listener);
        };
      }, []);
      return makeAuthContext({ user: currentUser, logout, refreshUser });
    });
    return { logout, refreshUser };
  }

  beforeEach(() => {
    setupStatefulAuth(false);
  });

  it('shows the "Delete my account" trigger in the email-confirm branch', () => {
    renderDangerZone();
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Delete my account" reveals the confirmation row', () => {
    renderDangerZone();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(
      screen.getByRole('button', { name: /yes, delete/i }),
    ).toBeInTheDocument();
  });

  it('confirming deletion when API returns requiresEmailConfirmation transitions to email-sent panel', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/account deletion link sent/i),
      ).toBeInTheDocument();
    });
  });

  // M4: CheckYourEmailPanel's tabIndex={-1} section pulls focus on mount so
  // the success announcement is the focused element right after the
  // email-confirm transition, not a stranded <body>.
  it('the "Check your email" panel receives focus on the email-confirm transition', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /account deletion link sent/i }),
      ).toHaveFocus();
    });
  });

  it('renders the email-sent panel on mount when the server flag is already pending', () => {
    setupStatefulAuth(true);
    renderDangerZone();

    expect(screen.getByText(/account deletion link sent/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /never mind, i want to keep my account/i,
      }),
    ).toBeInTheDocument();
  });

  it('"Never mind" button calls cancelPendingAccountDeletion and reverts to idle', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/account deletion link sent/i),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: /never mind, i want to keep my account/i,
        }),
      );
    });

    await waitFor(() => {
      expect(apiModule.cancelPendingAccountDeletion).toHaveBeenCalled();
    });

    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('"Never mind" reverts to idle even if cancelPendingAccountDeletion fails', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    vi.mocked(apiModule.cancelPendingAccountDeletion).mockRejectedValue(
      new Error('Network error'),
    );
    renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/account deletion link sent/i),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: /never mind, i want to keep my account/i,
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /delete my account/i }),
      ).toBeInTheDocument();
    });
  });

  // M3: the never-mind path runs while ActionGuard is unmounted, so
  // EmailConfirmDeleteFlow's own shouldFocusTriggerOnIdle effect returns
  // focus to the trigger after refreshUser() flips the server flag and the
  // idle trigger remounts.
  it('"Never mind" returns focus to the trigger after the panel unmounts', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    renderDangerZone();

    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/account deletion link sent/i),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: /never mind, i want to keep my account/i,
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /delete my account/i }),
      ).toHaveFocus();
    });
  });
});
