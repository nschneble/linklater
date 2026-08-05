/**
 * Tests for ResetPasswordPage.
 *
 * State machine: form → (loading spinner) → success-redirect | error → form
 * Token-from-URL paths:
 *   - No token → client-side error before API call
 *   - Password mismatch → client-side error before API call
 *   - API success → refreshUser hydrates auth, queue 'password-reset-success',
 *     navigate('/unread', { replace: true })
 *   - API success with MFA → mount MfaView, verifyOtp on submit, then queue
 *     'password-reset-success' + navigate('/unread')
 *   - API error → error in role="alert", form re-mounts
 *
 * The submit-in-flight surface is a bare centered spinner with an sr-only
 * polite status – matches VerifyLoginPage / TokenVerificationPage. The
 * destination /unread surfaces the 'password-reset-success' toast via the
 * pending-notice mirror.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import ResetPasswordPage from './ResetPasswordPage';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  resetPassword: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

const refreshUser = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ refreshUser }),
}));

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
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

function fillForm() {
  fireEvent.change(screen.getByLabelText(/^new password/i), {
    target: { value: 'correct-horse-battery' },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: 'correct-horse-battery' },
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.resetPassword).mockResolvedValue({
    accessToken: 'fresh-jwt',
    refreshToken: 'fresh-refresh',
  });
  refreshUser.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage client-side validation', () => {
  it('shows an error when no token is in the URL', async () => {
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

describe('ResetPasswordPage success path (non-MFA)', () => {
  it('calls resetPassword with the token and new password', async () => {
    const { container } = renderPage('?token=test-token-abc');

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.resetPassword).toHaveBeenCalledWith(
      'test-token-abc',
      'correct-horse-battery',
    );
  });

  it('renders an sr-only polite status while the reset is in flight', async () => {
    // hold the API call open so the loading state stays mounted
    let resolveReset: (value: {
      accessToken: string;
      refreshToken: string;
    }) => void = () => {};
    vi.mocked(apiModule.resetPassword).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      /resetting your password/i,
    );

    await act(async () => {
      resolveReset({ accessToken: 'a', refreshToken: 'r' });
    });
  });

  it('does NOT render a "Signing you in" success card or "I\'d like to log in now" button', async () => {
    let resolveReset: (value: {
      accessToken: string;
      refreshToken: string;
    }) => void = () => {};
    vi.mocked(apiModule.resetPassword).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.queryByText(/signing you in/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /i'd like to log in now/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveReset({ accessToken: 'a', refreshToken: 'r' });
    });
  });

  it("queues 'password-reset-success' pending notice on successful reset", async () => {
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'password-reset-success',
      );
    });
  });

  it('hydrates the auth context and navigates to /unread after a successful reset', async () => {
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
    expect(refreshUser).toHaveBeenCalled();
  });
});

describe('ResetPasswordPage MFA path', () => {
  it('mounts MfaView when the server returns an MFA challenge', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /multi-factor authentication/i }),
      ).toBeInTheDocument();
    });
    expect(refreshUser).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('queues the success notice and navigates to /unread after a valid OTP', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });
    vi.mocked(apiModule.verifyOtp).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    fireEvent.change(screen.getByLabelText(/code/i), {
      target: { value: '123456' },
    });

    await waitFor(() => {
      expect(apiModule.verifyOtp).toHaveBeenCalledWith(
        'mfa-tok',
        '123456',
        'totp',
      );
    });
    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'password-reset-success',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
  });
});

describe('ResetPasswordPage branding pin', () => {
  // branding pin: every branch sets data-theme="branding", never inherited
  it('renders the form in a branding-scoped wrapper', () => {
    const { container } = renderPage();
    expect(container.querySelector('[data-theme="branding"]')).not.toBeNull();
  });

  it('keeps the in-flight spinner branding-scoped', async () => {
    let resolveReset: (value: {
      accessToken: string;
      refreshToken: string;
    }) => void = () => {};
    vi.mocked(apiModule.resetPassword).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    const { container } = renderPage();
    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(
      screen.getByRole('status').closest('[data-theme="branding"]'),
    ).not.toBeNull();

    await act(async () => {
      resolveReset({ accessToken: 'a', refreshToken: 'r' });
    });
  });

  it('keeps the MFA challenge branding-scoped', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });
    const { container } = renderPage();
    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /multi-factor authentication/i }),
      ).toBeInTheDocument();
    });
    expect(container.querySelector('[data-theme="branding"]')).not.toBeNull();
  });
});

describe('ResetPasswordPage error path', () => {
  it('shows an error when resetPassword API call rejects', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue(
      new Error('Token expired'),
    );
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/token expired/i);
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows fallback error message for non-Error rejections', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue('boom');
    const { container } = renderPage();

    fillForm();

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
