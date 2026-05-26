import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import DangerZone from './DangerZone';
import { consumeAuthNotice } from '../../auth/authNotice';

vi.mock('../../lib/api', () => ({
  deleteMe: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: null,
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

describe('DangerZone', () => {
  it('renders the initial delete account button', () => {
    render(<DangerZone />);
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('does not show confirmation prompt on initial render', () => {
    render(<DangerZone />);
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('shows confirmation prompt when delete account is clicked', () => {
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /yes, delete/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /no, don't delete/i }),
    ).toBeInTheDocument();
  });

  it('hides confirmation prompt when cancel is clicked', () => {
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /no, don't delete/i }));

    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('calls deleteMe and logout when confirmed', async () => {
    const logoutMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout: logoutMock }));
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(apiModule.deleteMe).toHaveBeenCalledOnce();
      expect(logoutMock).toHaveBeenCalledOnce();
    });
  });

  it('shows an error when deletion fails', async () => {
    vi.mocked(apiModule.deleteMe).mockRejectedValue(
      new Error('Failed to delete account'),
    );

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to delete account')).toBeInTheDocument();
    });
  });

  it('shows a fallback error when deletion throws a non-Error', async () => {
    vi.mocked(apiModule.deleteMe).mockRejectedValue('network error');

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to delete account')).toBeInTheDocument();
    });
  });

  it('queues the account-deleted notice before logging out', async () => {
    const logoutMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout: logoutMock }));
    vi.mocked(apiModule.deleteMe).mockResolvedValue({ success: true });

    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce());
    expect(consumeAuthNotice()).toBe('Your account has been deleted.');
  });

  it('does not queue the notice when deletion fails', async () => {
    vi.mocked(apiModule.deleteMe).mockRejectedValue(new Error('boom'));
    render(<DangerZone />);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(consumeAuthNotice()).toBeNull();
  });
});
