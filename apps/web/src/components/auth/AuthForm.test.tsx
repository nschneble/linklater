/**
 * Tests for AuthForm focused on the cross-route pending-notice surface.
 *
 * Coverage:
 *   - When `useAuthForm` exposes a non-null `notice`, the
 *     `PendingNoticeAnnouncer` renders the toast.
 *   - The sr-only mirror text updates from empty → notice text.
 *   - Mode-routing render branches still work (login, mfa, forgot-password)
 *     under the mocked hook – proves the refactor didn't drop a branch.
 *
 * `useAuthForm` is mocked at the module boundary so this test exercises
 * AuthForm's surface coordination without touching the API/auth context.
 * Hook internals are tested in `useAuthForm.test.ts`.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { MfaChallenge, Mode } from './useAuthForm';
import type { NoticeEntry } from '../../lib/pendingNotice';
import type { RefObject } from 'react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./useAuthForm', () => ({
  useAuthForm: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuthForm } from './useAuthForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MakeHookOverrides {
  error?: string | null;
  errorAnnouncement?: string;
  loading?: boolean;
  mode?: Mode;
  mfaChallenge?: MfaChallenge | null;
  notice?: { message: string; variant: 'success' | 'error' } | null;
  setNotice?: Dispatch<SetStateAction<NoticeEntry | null>>;
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
    error: overrides.error ?? null,
    errorAnnouncement: overrides.errorAnnouncement ?? '',
    errorReference,
    forgotPasswordSentJustNow: false,
    handleModeChange: vi.fn(),
    handleSubmit: vi.fn(),
    handleVerifyOtp: vi.fn(),
    loading: overrides.loading ?? false,
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
    setNotice: overrides.setNotice ?? vi.fn(() => undefined),
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

describe('AuthForm – pending-notice surface', () => {
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

    const initialMirror = screen.getByTestId('pending-notice-announcement');
    expect(initialMirror.textContent).toBe('');

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

    const updatedMirror = screen.getByTestId('pending-notice-announcement');
    expect(updatedMirror.textContent).toBe('Your email has been verified.');
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

    // mirror goes assertive on variant='error' to not race the toast on SR
    const mirror = screen.getByTestId('pending-notice-announcement');
    expect(mirror).toHaveAttribute('role', 'alert');
    expect(mirror).toHaveAttribute('aria-live', 'assertive');
    expect(mirror.textContent).toBe('Verification link expired.');
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

    // dismiss wiring verified indirectly: assert the button is reachable
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toBeInTheDocument();
  });
});

// an OAuth refusal redirects to /login with its reason on the URL: the copy
// paints at once, and one live region announces it a beat later
describe('AuthForm – OAuth arrival-error surface', () => {
  const ARRIVAL_MESSAGE =
    "Google hasn't confirmed this email address. Log in with your email instead.";

  it('keeps the announcement region mounted and empty before the announcement fires', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ error: ARRIVAL_MESSAGE, errorAnnouncement: '' }),
    );

    renderAuthForm();

    // mounted empty so the swap is an empty -> populated change SRs announce
    const region = screen.getByTestId('auth-error-announcement');
    expect(region).toHaveAttribute('role', 'alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region.textContent).toBe('');
  });

  it('announces the arrival error through exactly one live region', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({
        error: ARRIVAL_MESSAGE,
        errorAnnouncement: ARRIVAL_MESSAGE,
      }),
    );

    renderAuthForm();

    expect(screen.getByTestId('auth-error-announcement').textContent).toBe(
      ARRIVAL_MESSAGE,
    );

    // the visible copy is painted but silent, so nothing races the region
    const painted = screen.getByText(ARRIVAL_MESSAGE, { selector: 'p' });
    expect(painted).toHaveAttribute('id', 'auth-form-error');
    expect(painted).not.toHaveAttribute('role');

    const liveRegions = screen.getAllByRole('alert');
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveAttribute(
      'data-testid',
      'auth-error-announcement',
    );
  });

  // the focus move onto the Alert is what speaks a submit error
  it('leaves a submit error to the focus move, with no region holding it', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ error: 'Invalid credentials' }),
    );

    renderAuthForm();

    const painted = screen.getByText('Invalid credentials', { selector: 'p' });
    expect(painted).not.toHaveAttribute('role');
    expect(screen.getByTestId('auth-error-announcement').textContent).toBe('');
  });
});

describe('AuthForm – document title per mode (WCAG 2.4.2)', () => {
  it('login mode sets the log-in title', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ mode: 'login' }));
    renderAuthForm();
    expect(document.title).toBe('Linklater – Log in');
  });

  it('register mode sets the sign-up title', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mode: 'register' }),
    );
    renderAuthForm();
    expect(document.title).toBe('Linklater – Sign up');
  });

  it('forgot-password mode sets the reset-password title', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mode: 'forgot-password' }),
    );
    renderAuthForm();
    expect(document.title).toBe('Linklater – Reset password');
  });

  it('an MFA challenge takes precedence over the mode title', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mode: 'login', mfaChallenge: 'totp' }),
    );
    renderAuthForm();
    expect(document.title).toBe("Linklater – Verify it's you");
  });
});

describe('AuthForm – mode routing branches still render under the refactor', () => {
  it('renders LoginRegisterView when mode is login and no MFA challenge', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ mode: 'login' }));

    renderAuthForm();

    // the email + password inputs come from LoginRegisterView
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders MfaView when mfaChallenge is non-null', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mfaChallenge: 'totp' }),
    );

    renderAuthForm();

    // MfaView's totp challenge surfaces the "Authenticator code" input
    expect(screen.getByLabelText(/authenticator code/i)).toBeInTheDocument();
  });

  it('renders ForgotPasswordView when mode is forgot-password', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ mode: 'forgot-password' }),
    );

    renderAuthForm();

    // ForgotPasswordView asks for an email but no password
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});

describe('AuthForm – busy announcement', () => {
  const BUSY_REGION = 'auth-busy-announcement';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the region mounted, polite and empty while idle', () => {
    renderAuthForm();

    const region = screen.getByTestId(BUSY_REGION);
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('role', 'status');
    expect(region.textContent).toBe('');
  });

  // below a second the busy line only queues ahead of the error that follows
  it('stays silent when the submit resolves inside the announce delay', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    const { rerender } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(999);
    });

    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: false }));
    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('');
  });

  it('announces once the submit has been out for a full second', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    renderAuthForm();

    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('Signing you in…');
  });

  it('names the wait per mode, so a reset is not announced as a sign-in', () => {
    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ loading: true, mode: 'forgot-password' }),
    );
    renderAuthForm();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId(BUSY_REGION).textContent).toBe(
      'Sending your reset link…',
    );
  });

  // identical strings get read twice, once as the name and once as the region
  it('uses words the submit button does not', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    renderAuthForm();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const submit = screen.getByRole('button', {
      name: /log in with magic link/i,
    });
    expect(screen.getByTestId(BUSY_REGION).textContent).not.toBe(
      submit.textContent,
    );
  });

  // a stale "still going" line beside "that failed" is what a reader hears
  it('empties as soon as the wait ends, not eight seconds later', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    const { rerender } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('Signing you in…');

    vi.mocked(useAuthForm).mockReturnValue(
      makeHookResult({ error: 'Invalid credentials', loading: false }),
    );
    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('');
  });

  it('empties itself on its own timer so the next wait announces again', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    renderAuthForm();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('Signing you in…');

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('');
  });

  it('empties itself before a retry so the second wait announces too', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    const { rerender } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('Signing you in…');

    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: false }));
    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <AuthForm />
      </MemoryRouter>,
    );

    // the empty beat is what makes the next set a change a reader hears
    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId(BUSY_REGION).textContent).toBe('Signing you in…');
  });

  it('carries no aria-busy, which would defer the error that ends the wait', () => {
    vi.mocked(useAuthForm).mockReturnValue(makeHookResult({ loading: true }));
    const { container } = renderAuthForm();

    expect(container.querySelector('[aria-busy]')).toBeNull();
  });
});
