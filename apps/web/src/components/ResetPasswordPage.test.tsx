import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('../lib/api', () => ({
  resetPassword: vi.fn(),
}));

import * as apiModule from '../lib/api';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function renderResetPage(search = '?token=reset-abc') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

function fillForm(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/new password/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: confirm },
  });
}

describe('ResetPasswordPage', () => {
  it('renders the reset password form', () => {
    renderResetPage();
    expect(
      screen.getByRole('button', { name: /reset password/i }),
    ).toBeInTheDocument();
  });

  it('shows an error when no token is present in the URL', async () => {
    renderResetPage('');
    fillForm('strong-password-123', 'strong-password-123');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/no reset token found/i)).toBeInTheDocument();
    });
  });

  it('shows an error when passwords do not match', async () => {
    renderResetPage();
    fillForm('strong-password-123', 'different-password-456');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('shows success state after a successful reset', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
    renderResetPage();
    fillForm('strong-password-123', 'strong-password-123');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });

  it('shows a link to go to Linklater after success', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue(undefined);
    renderResetPage();
    fillForm('strong-password-123', 'strong-password-123');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /go to linklater/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows an API error message when the reset fails', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue(
      new Error('Token expired or invalid'),
    );
    renderResetPage();
    fillForm('strong-password-123', 'strong-password-123');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Token expired or invalid')).toBeInTheDocument();
    });
  });

  it('shows a fallback error message when the error is not an Error instance', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue('unknown');
    renderResetPage();
    fillForm('strong-password-123', 'strong-password-123');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Password reset failed.')).toBeInTheDocument();
    });
  });

  it('shows a back to login link', () => {
    renderResetPage();
    expect(
      screen.getByRole('button', { name: /back to login/i }),
    ).toBeInTheDocument();
  });

  it('does not call the API when passwords do not match', async () => {
    renderResetPage();
    fillForm('strong-password-123', 'different-password');
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    expect(apiModule.resetPassword).not.toHaveBeenCalled();
  });
});
