import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import DangerZone from './DangerZone';
import { consumeAuthNotice } from '../../auth/authNotice';

vi.mock('../../lib/api', () => ({
  cancelPendingAccountDeletion: vi.fn(),
  deleteMe: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

function makeUser(overrides = {}) {
  return {
    userId: 'user-1',
    email: 'me@example.com',
    hasPassword: false,
    multiFactorMethod: null as 'totp' | null,
    multiFactorPending: false,
    ...overrides,
  };
}

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: makeUser(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

// ===========================================================================
// Credentialed branch (hasPassword || multiFactorMethod)
// ===========================================================================

describe('DangerZone — credentialed branch', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ hasPassword: true }) }),
    );
  });

  it('shows the Delete trigger in idle state', () => {
    render(<DangerZone />);
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/confirm your identity/i),
    ).not.toBeInTheDocument();
  });

  it('reveals ReauthForm when the trigger is clicked', () => {
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(
      screen.getByText(/confirm your identity to permanently delete/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('focuses the password input when the form opens', async () => {
    render(<DangerZone />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /delete my account/i }),
      );
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByLabelText(/current password/i),
      );
    });
  });

  it('submits with currentPassword when the password field is filled', async () => {
    const logoutMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ hasPassword: true }),
        logout: logoutMock,
      }),
    );
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => {
      expect(apiModule.deleteMe).toHaveBeenCalledWith({
        currentPassword: 'pw',
        code: undefined,
      });
      expect(logoutMock).toHaveBeenCalledOnce();
    });
  });

  it('submits with code when only the code field is filled (TOTP path)', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
    );
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(
      screen.getByLabelText(/or enter an authenticator or recovery code/i),
      { target: { value: '123456' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => {
      expect(apiModule.deleteMe).toHaveBeenCalledWith({
        currentPassword: undefined,
        code: '123456',
      });
    });
  });

  it('queues the account-deleted notice before logging out', async () => {
    const logoutMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ hasPassword: true }),
        logout: logoutMock,
      }),
    );
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce());
    expect(consumeAuthNotice()).toBe('Your account has been deleted.');
  });

  it('shows the error and stays on the form on failure', async () => {
    vi.mocked(apiModule.deleteMe).mockRejectedValue(new Error('boom'));
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('boom');
    });
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('returns focus to the trigger when Cancel is clicked', async () => {
    render(<DangerZone />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /delete my account/i }),
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /delete my account/i }),
      );
    });
  });

  it('closes the form and returns focus to the trigger when Escape is pressed', async () => {
    render(<DangerZone />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /delete my account/i }),
      );
    });
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/confirm your identity/i),
      ).not.toBeInTheDocument();
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /delete my account/i }),
      );
    });
  });
});

// ===========================================================================
// Email-confirm branch (magic-link-only-no-MFA)
// ===========================================================================

describe('DangerZone — email-confirm branch', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ hasPassword: false, multiFactorMethod: null }),
      }),
    );
  });

  it('renders the two-step ActionGuard trigger', () => {
    render(<DangerZone />);
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/confirm your identity/i),
    ).not.toBeInTheDocument();
  });

  it('shows the Are-you-sure row after the trigger is clicked', () => {
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('calls deleteMe() with no body on the email path', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(apiModule.deleteMe).toHaveBeenCalledWith();
    });
  });

  it('swaps to the "Check your email" panel on requiresEmailConfirmation', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /check your email/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/we sent a confirmation link to me@example.com/i),
    ).toBeInTheDocument();
  });

  it('does not call logout when entering the email-sent panel', async () => {
    const logoutMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({
        user: makeUser({ hasPassword: false, multiFactorMethod: null }),
        logout: logoutMock,
      }),
    );
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /check your email/i }),
      ).toBeInTheDocument();
    });
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('focuses the panel wrapper when it appears', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    render(<DangerZone />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /delete my account/i }),
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });
    await waitFor(() => {
      const heading = screen.getByRole('heading', {
        name: /check your email/i,
      });
      // Wrapper section is the element that owns aria-labelledby + tabIndex.
      const section = heading.closest('section');
      expect(section).not.toBeNull();
      expect(document.activeElement).toBe(section);
    });
  });

  it('calls cancelPendingAccountDeletion and reverts to the trigger on "Never mind"', async () => {
    vi.mocked(apiModule.deleteMe).mockResolvedValue({
      success: true,
      requiresEmailConfirmation: true,
    });
    vi.mocked(apiModule.cancelPendingAccountDeletion).mockResolvedValue(
      undefined,
    );

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /check your email/i }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /never mind, keep my account/i }),
      );
    });

    await waitFor(() => {
      expect(apiModule.cancelPendingAccountDeletion).toHaveBeenCalledOnce();
      expect(
        screen.getByRole('button', { name: /delete my account/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /check your email/i }),
      ).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// Loading guard
// ===========================================================================

describe('DangerZone — auth loading guard', () => {
  it('renders only a disabled trigger while useAuth is loading', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: null, loading: true }),
    );
    render(<DangerZone />);
    const trigger = screen.getByRole('button', { name: /delete my account/i });
    expect(trigger).toBeDisabled();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/confirm your identity/i),
    ).not.toBeInTheDocument();
  });

  it('renders only a disabled trigger while user is null and loading=false (logged-out edge)', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: null, loading: false }),
    );
    render(<DangerZone />);
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeDisabled();
  });
});
