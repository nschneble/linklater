/**
 * Tests for ResetPasswordPage.
 *
 * State machine: form → (loading) → success | error
 * Token-from-URL paths:
 *   - No token → client-side error before API call
 *   - Password mismatch → client-side error before API call
 *   - API success → sr-only status + queue 'password-reset-success' notice +
 *     navigate('/login', { replace: true }) after a brief announcement window
 *   - API error → error in role="alert"
 */

import ResetPasswordPage from './ResetPasswordPage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  resetPassword: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';
import * as pendingNoticeModule from '../../lib/pendingNotice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage client-side validation', () => {
  it('shows an error when no token is in the URL', async () => {
    renderPage('');
    const { container } = render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/no reset token/i);
    expect(apiModule.resetPassword).not.toHaveBeenCalled();
  });

  it('shows "Passwords do not match" when the confirm field differs', async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'different-password' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /passwords do not match/i,
    );
    expect(apiModule.resetPassword).not.toHaveBeenCalled();
  });
});

describe('ResetPasswordPage success path', () => {
  it('calls resetPassword with the token and new password', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
    const { container } = renderPage('?token=test-token-abc');

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'correct-horse-battery' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.resetPassword).toHaveBeenCalledWith(
      'test-token-abc',
      'correct-horse-battery',
    );
  });

  it('renders an sr-only polite confirmation after a successful reset', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'correct-horse-battery' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/password updated/i);
    });
  });

  it('does NOT render the legacy "I\'d like to log in now" button or bouncing checkmark', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'correct-horse-battery' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /i'd like to log in now/i }),
    ).not.toBeInTheDocument();
  });

  it("queues 'password-reset-success' pending notice on successful reset", async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'correct-horse-battery' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'password-reset-success',
      );
    });
  });

  it('navigates to /login with replace:true after the announcement delay', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
      const { container } = renderPage();

      fireEvent.change(screen.getByLabelText(/^new password/i), {
        target: { value: 'correct-horse-battery' },
      });
      fireEvent.change(screen.getByLabelText(/confirm new password/i), {
        target: { value: 'correct-horse-battery' },
      });

      await act(async () => {
        fireEvent.submit(container.querySelector('form')!);
      });

      // Pre-delay: navigation has NOT yet fired (the sr-only status is
      // mounted and given time to start its polite utterance).
      expect(navigate).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ResetPasswordPage error path', () => {
  it('shows an error when resetPassword API call rejects', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue(
      new Error('Token expired'),
    );
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'correct-horse-battery' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/token expired/i);
    });
  });

  it('shows fallback error message for non-Error rejections', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue('boom');
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'correct-horse-battery' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /password reset failed/i,
      );
    });
  });
});
