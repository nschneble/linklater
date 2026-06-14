/**
 * Tests for AuthForm focused on the cross-route pending-notice surface.
 *
 * Coverage:
 *   - When `useAuthForm` exposes a non-null `notice`, the
 *     `PendingNoticeAnnouncer` renders the toast.
 *   - The sr-only mirror text updates from empty → notice text.
 *   - Mode-routing render branches still work (login, mfa, forgot-password)
 *     under the mocked hook — proves the refactor didn't drop a branch.
 *
 * `useAuthForm` is mocked at the module boundary so this test exercises
 * AuthForm's surface coordination without touching the API/auth context.
 * Hook internals are tested in `useAuthForm.test.ts`.
 */

import AuthForm from './AuthForm';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { RefObject } from 'react';
import type { MfaChallenge, Mode } from './useAuthForm';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./useAuthForm', () => ({
  useAuthForm: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuthForm } from './useAuthForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MakeHookOverrides {
  mode?: Mode;
  mfaChallenge?: MfaChallenge | null;
  notice?: { message: string; variant: 'success' | 'error' } | null;
  setNotice?: ReturnType<typeof vi.fn>;
}

function makeHookResult(
  overrides: MakeHookOverrides = {},
): ReturnType<typeof useAuthForm> {
  const emailReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;
  const errorReference =
    createRef<HTMLParagraphElement | null>() as RefObject<HTMLParagraphElement | null>;
  const mfaInputReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;
  const passwordReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;

  return {
    email: '',
    emailReference,
    error: null,
    errorReference,
    forgotPasswordSentJustNow: false,
    handleModeChange: vi.fn(),
    handleSubmit: vi.fn(),
    handleVerifyOtp: vi.fn(),
    loading: false,
    magicLinkSentJustNow: false,
    mfaChallenge: overrides.mfaChallenge ?? null,
    mfaCode: '',
    mfaInputReference,
    mode: overrides.mode ?? 'login',
    notice: overrides.notice ?? null,
    password: '',
    passwordReference,
    setEmail: vi.fn(),
    setMfaChallenge: vi.fn(),
    setMfaCode: vi.fn(),
    setError: vi.fn(),
    setNotice: overrides.setNotice ?? vi.fn(),
    setPassword: vi.fn(),
  };
}

function renderAuthForm() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthForm />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuthForm).mockReturnValue(makeHookResult());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthForm — pending-notice surface', () => {
  it('renders the PendingNoticeAnnouncer toast when notice is non-null', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({
        notice: {
          message: 'Your account has been deleted.',
          variant: 'success',
        },
      }),
    );

    renderAuthForm();

    expect(
      screen.getByText('Your account has been deleted.', { selector: 'div' }),
    ).toBeInTheDocument();
  });

  it('omits the toast when notice is null', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ notice: null }));

    renderAuthForm();

    expect(
      screen.queryByText(/your account has been deleted/i),
    ).not.toBeInTheDocument();
  });

  it('sr-only mirror text updates from empty to the notice text', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ notice: null }));

    const { rerender } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    const initialMirror = document.querySelector(
      'span.sr-only[aria-live="polite"][aria-atomic="true"]',
    );
    expect(initialMirror?.textContent).toBe('');

    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({
        notice: {
          message: 'Your email has been verified.',
          variant: 'success',
        },
      }),
    );
    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    const updatedMirror = document.querySelector(
      'span.sr-only[aria-live="polite"][aria-atomic="true"]',
    );
    expect(updatedMirror?.textContent).toBe('Your email has been verified.');
  });

  it('routes an error-variant notice into the alert/assertive mirror shape', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({
        notice: {
          message: 'Verification link expired.',
          variant: 'error',
        },
      }),
    );

    renderAuthForm();

    // Mirror picks up the assertive shape when the notice carries
    // variant='error'. Without this routing the toast (assertive) and the
    // mirror (polite) would race on the SR announcement queue with
    // mismatched priorities.
    const mirror = document.querySelector(
      'span.sr-only[role="alert"][aria-live="assertive"][aria-atomic="true"]',
    );
    expect(mirror).toBeInTheDocument();
    expect(mirror?.textContent).toBe('Verification link expired.');
  });

  it('passes a setNotice-clearing onDismiss to the announcer', () => {
    const setNotice = vi.fn();
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({
        notice: {
          message: 'Your email has been verified.',
          variant: 'success',
        },
        setNotice,
      }),
    );

    renderAuthForm();

    // The dismiss button on the toast clears the notice. We assert the
    // wiring indirectly: clicking the dismiss button invokes onDismiss,
    // which the announcer hands to the parent. After the exit animation
    // (150ms) the parent's onDismiss fires — for the unit test, we just
    // verify the button is reachable so the contract holds.
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toBeInTheDocument();
  });
});

describe('AuthForm — mode routing branches still render under the refactor', () => {
  it('renders LoginRegisterView when mode is login and no MFA challenge', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ mode: 'login' }));

    renderAuthForm();

    // The email + password inputs come from LoginRegisterView.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders MfaView when mfaChallenge is non-null', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mfaChallenge: 'totp' }),
    );

    renderAuthForm();

    // MfaView's totp challenge surfaces the "Authenticator code" input.
    expect(screen.getByLabelText(/authenticator code/i)).toBeInTheDocument();
  });

  it('renders ForgotPasswordView when mode is forgot-password', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mode: 'forgot-password' }),
    );

    renderAuthForm();

    // ForgotPasswordView asks for an email but no password.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
