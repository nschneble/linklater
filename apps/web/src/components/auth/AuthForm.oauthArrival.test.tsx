/**
 * End-to-end check of the OAuth refusal exit path on the web side: the real
 * `useAuthForm` driving the real view, entered the way a refused provider
 * callback enters it, at `/login?error=…&provider=…`.
 *
 * Every other test in this folder mocks one side or the other. This one
 * exists because the failure mode being guarded against is an interaction:
 * the parameter is stripped in a mount effect, the mode effect clears
 * `error` in the same flush, and the announcement has to survive both.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';
import { MemoryRouter } from 'react-router';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  forgotPassword: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARRIVAL_PATH = '/login?error=provider_email_unverified&provider=google';
const ARRIVAL_MESSAGE =
  "Google hasn't confirmed this email address. Log in with your email instead.";
const ANNOUNCE_DELAY_MS = 1000;

function renderArrival(path = ARRIVAL_PATH) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthForm />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthForm – arriving from a refused OAuth callback', () => {
  it('paints the recovery copy without waiting on the announcement', async () => {
    renderArrival();
    await act(async () => {});

    const painted = screen.getByText(ARRIVAL_MESSAGE, { selector: 'p' });
    expect(painted).toHaveAttribute('id', 'auth-form-error');
    expect(screen.getByTestId('auth-error-announcement').textContent).toBe('');
  });

  it('announces it once the page-load window has passed', async () => {
    renderArrival();
    await act(async () => {});

    await act(async () => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });

    const regions = screen.getAllByRole('alert');
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveAttribute(
      'data-testid',
      'auth-error-announcement',
    );
    expect(regions[0].textContent).toBe(ARRIVAL_MESSAGE);
  });

  it('leaves focus where the user can start typing', async () => {
    renderArrival();
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    });

    // auto-focus would flip a screen reader to forms mode mid-announcement,
    // and focusing the alert would put the next Tab past both inputs
    expect(document.activeElement).toBe(document.body);
  });

  it('still describes both inputs with the alert it painted', async () => {
    renderArrival();
    await act(async () => {});

    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      'aria-describedby',
      'auth-form-error',
    );
    expect(screen.getByLabelText(/password/i)).toHaveAttribute(
      'aria-describedby',
      'auth-form-error',
    );
  });

  it('focuses the email input on a clean arrival (negative control)', async () => {
    renderArrival('/login');
    await act(async () => {});

    expect(document.activeElement).toBe(screen.getByLabelText(/email/i));
    expect(screen.getByTestId('auth-error-announcement').textContent).toBe('');
  });
});
