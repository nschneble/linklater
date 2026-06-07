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

import EmailSettingsForm from './EmailSettingsForm';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

import * as apiModule from '../../lib/api';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    connectedProviders: [],
    cvdMode: false,
    email: 'current@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00.000Z',
    hasPassword: true,
    pendingEmail: null,
    mode: 'light',
    theme: 'scanner-darkly',
    multiFactorMethod: null,
    multiFactorPending: false,
    userId: 'user-1',
    welcomedAt: null,
    ...overrides,
  };
}

function makeAuthContext(
  overrides: Partial<{
    user: User | null;
    resendVerificationEmail: ReturnType<typeof vi.fn>;
    setPendingEmail: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    resendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    setPendingEmail: vi.fn(),
    markWelcomed: vi.fn(),
    user: makeUser(),
    ...overrides,
  };
}

function renderForm() {
  return render(<EmailSettingsForm />);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
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
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ setPendingEmail }));
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
  it('does not show the "Resend verification email" button for verified accounts', () => {
    renderForm();
    expect(
      screen.queryByRole('button', { name: /resend verification email/i }),
    ).not.toBeInTheDocument();
  });
});
