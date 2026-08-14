/**
 * Tests for EmailSettingsForm.
 *
 * Covers:
 *   - Happy path: submit valid new email → success message
 *   - Redundant submit (same email) → "Nothing to update"
 *   - API error → error in role="alert"
 *   - Unverified state → "Resend verification email" link visible
 *   - Resend success / error
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmailSettingsForm from './EmailSettingsForm';
import type { User } from '../../auth/AuthContext/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  return {
    ApiError,
    requestEmailChange: vi.fn(),
  };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { ApiError } from '../../lib/api';
import * as apiModule from '../../lib/api';
import { makeAuthContext, makeUser } from '../../../test/factories';
import { useAuth } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm() {
  return render(<EmailSettingsForm />);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext({ user: makeUser() }));
  vi.mocked(apiModule.requestEmailChange).mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EmailSettingsForm happy path', () => {
  it('calls requestEmailChange with the new email on submit', async () => {
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'new@example.com' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.requestEmailChange).toHaveBeenCalledWith(
      'new@example.com',
    );
  });

  it('calls setPendingEmail after a successful email change request', async () => {
    const setPendingEmail = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ setPendingEmail, user: makeUser() }),
    );
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'new@example.com' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(setPendingEmail).toHaveBeenCalledWith('new@example.com');
  });
});

describe('EmailSettingsForm redundant submit', () => {
  it('shows "Nothing to update" when the new email matches the current email', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ email: 'same@example.com' }) }),
    );
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'same@example.com' },
    });

    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getByRole('status')).toHaveTextContent(/nothing to update/i);
    expect(apiModule.requestEmailChange).not.toHaveBeenCalled();
  });
});

describe('EmailSettingsForm error path', () => {
  it('shows error in role="alert" when requestEmailChange rejects', async () => {
    vi.mocked(apiModule.requestEmailChange).mockRejectedValue(
      new Error('Email already in use'),
    );
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'taken@example.com' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /email already in use/i,
      );
    });
  });

  it('shows error in role="alert" when requestEmailChange rejects with ApiError 403', async () => {
    vi.mocked(apiModule.requestEmailChange).mockRejectedValue(
      new ApiError('MFA code required', 403),
    );
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'new@example.com' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/mfa code required/i);
    });
  });
});

describe('EmailSettingsForm unverified state', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ emailVerifiedAt: null }),
      }),
    );
  });

  it('shows the "Resend verification email" button for unverified accounts', () => {
    renderForm();
    expect(
      screen.getByRole('button', { name: /resend verification email/i }),
    ).toBeInTheDocument();
  });

  it('shows a success message after a successful resend', async () => {
    renderForm();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /resend verification email/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /verification email sent/i,
      );
    });
  });

  it('shows an error when resendVerificationEmail rejects', async () => {
    const resendVerificationEmail = vi
      .fn()
      .mockRejectedValue(new Error('Rate limited'));
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ emailVerifiedAt: null }),
        resendVerificationEmail,
      }),
    );
    renderForm();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /resend verification email/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/rate limited/i);
    });
  });
});

describe('EmailSettingsForm verified state', () => {
  it('does not show the "Resend verification email" button for verified accounts with no pending change', () => {
    renderForm();
    expect(
      screen.queryByRole('button', { name: /resend verification email/i }),
    ).not.toBeInTheDocument();
  });
});

describe('EmailSettingsForm pending-email resend', () => {
  function makePendingAuth(overrides: Partial<AuthContextValue> = {}) {
    return makeAuthContext({
      user: makeUser({ pendingEmail: 'new@example.com' }),
      ...overrides,
    });
  }

  it('shows the "Resend verification email" button when an email change is pending', () => {
    vi.mocked(useAuth).mockReturnValue(makePendingAuth());
    renderForm();
    expect(
      screen.getByRole('button', { name: /resend verification email/i }),
    ).toBeInTheDocument();
  });

  it('button is wired to the pending-email notice via aria-describedby', () => {
    vi.mocked(useAuth).mockReturnValue(makePendingAuth());
    renderForm();
    const button = screen.getByRole('button', {
      name: /resend verification email/i,
    });
    expect(button).toHaveAttribute('aria-describedby', 'pending-email-notice');
    expect(document.getElementById('pending-email-notice')).toHaveTextContent(
      /verification link sent to new@example\.com/i,
    );
  });

  it('calls resendEmailChangeVerification on click and shows a success message', async () => {
    const resendEmailChangeVerification = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(
      makePendingAuth({ resendEmailChangeVerification }),
    );
    renderForm();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /resend verification email/i }),
      );
    });

    expect(resendEmailChangeVerification).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const success = screen
        .getAllByText(/verification email sent/i)
        .find((node) => /new address/i.test(node.textContent ?? ''));
      expect(success).toBeTruthy();
    });
  });

  it('shows an error in role="alert" when the resend rejects', async () => {
    const resendEmailChangeVerification = vi
      .fn()
      .mockRejectedValue(new Error('Rate limited'));
    vi.mocked(useAuth).mockReturnValue(
      makePendingAuth({ resendEmailChangeVerification }),
    );
    renderForm();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /resend verification email/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/rate limited/i);
    });
  });
});

// regression: exactly one polite-status Alert, not two (WCAG 1.3.1, 4.1.3)
describe('EmailSettingsForm post-submit notice – no duplicate', () => {
  it('renders exactly one verification notice after a successful submit', async () => {
    // stateful mock: setPendingEmail re-renders useAuth so the Alert appears
    let currentUser: User = makeUser({ pendingEmail: null });
    const setPendingEmail = vi.fn((pending: string) => {
      currentUser = { ...currentUser, pendingEmail: pending };
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ setPendingEmail, user: currentUser }),
      );
    });
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ setPendingEmail, user: currentUser }),
    );

    const { container, rerender } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'new@example.com' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    // re-render so the form picks up the mutated `useAuth` return value
    rerender(<EmailSettingsForm />);

    await waitFor(() => {
      expect(screen.getAllByText(/verification link sent to/i)).toHaveLength(1);
    });
  });

  it('exposes the verification notice via role="status" only – no role="alert" on success', async () => {
    let currentUser: User = makeUser({ pendingEmail: null });
    const setPendingEmail = vi.fn((pending: string) => {
      currentUser = { ...currentUser, pendingEmail: pending };
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ setPendingEmail, user: currentUser }),
      );
    });
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ setPendingEmail, user: currentUser }),
    );

    const { container, rerender } = renderForm();

    fireEvent.change(screen.getByLabelText(/new email/i), {
      target: { value: 'new@example.com' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    rerender(<EmailSettingsForm />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /verification link sent to/i,
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
