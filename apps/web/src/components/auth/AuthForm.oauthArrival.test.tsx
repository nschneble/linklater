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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';
import { MemoryRouter } from 'react-router';
import { StrictMode } from 'react';

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
const UNKNOWN_MESSAGE =
  "That sign-in didn't finish. Log in with your email instead.";
const ANNOUNCE_DELAY_MS = 1000;
const CLEAR_DELAY_MS = 8000;

function renderArrival(path = ARRIVAL_PATH) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthForm />
    </MemoryRouter>,
  );
}

/** Advances past the announce hold, so the mirror holds the message. */
async function announce() {
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
  });
}

function mirrorText(): string | null {
  return screen.getByTestId('auth-error-announcement').textContent;
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

  // `__proto__` used to resolve to an object and `constructor` to a
  // function, which useFlashQueryParameters then ran as a setState updater.
  // Either one reaches the render as a non-string child, and React 19
  // throws on that: /login?error=__proto__ took the whole route down, into
  // an ErrorBoundary whose retry reloads straight back into the crash
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'paints the fallback copy for ?error=%s',
    async (code) => {
      renderArrival(`/login?error=${code}&provider=google`);
      await act(async () => {});

      expect(
        screen.getByText(UNKNOWN_MESSAGE, { selector: 'p' }),
      ).toHaveAttribute('id', 'auth-form-error');
    },
  );

  // StrictMode double-invokes mount effects, so a guard that released by
  // consuming itself inside one would hand the second invocation a clean
  // answer and auto-focus the arrival after all
  it('holds focus off the arrival under StrictMode', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[ARRIVAL_PATH]}>
          <AuthForm />
        </MemoryRouter>
      </StrictMode>,
    );
    await act(async () => {});

    expect(document.activeElement).toBe(document.body);
  });

  describe('once the announcement has been heard', () => {
    it('empties the region instead of leaving it populated', async () => {
      renderArrival();
      await announce();
      expect(mirrorText()).toBe(ARRIVAL_MESSAGE);

      await act(async () => {
        vi.advanceTimersByTime(CLEAR_DELAY_MS);
      });

      expect(mirrorText()).toBe('');
    });

    // AuthForm does not remount across the auth routes, so the mode change
    // clears the visible Alert while the mirror keeps its copy: last in the
    // document, unlabelled, on a page with no `main` landmark
    it('strands nothing on the sign-up screen', async () => {
      renderArrival();
      await announce();

      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));
      });

      // the visible copy is gone, so the mirror is the only one left
      expect(screen.queryByText(ARRIVAL_MESSAGE, { selector: 'p' })).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(CLEAR_DELAY_MS);
      });

      expect(mirrorText()).toBe('');
    });
  });
});
