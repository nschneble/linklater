import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from './VerifyEmailPage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../lib/api', () => ({
  verifyEmail: vi.fn(),
}));

import * as apiModule from '../lib/api';

afterEach(() => vi.restoreAllMocks());

function renderVerifyPage(search = '?token=verify-abc') {
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage', () => {
  it('shows verifying state while the request is in flight', () => {
    vi.mocked(apiModule.verifyEmail).mockReturnValue(new Promise(() => {}));
    renderVerifyPage();
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
  });

  it('shows success state after email is verified', async () => {
    vi.mocked(apiModule.verifyEmail).mockResolvedValue(undefined);
    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByText(/email has been verified/i)).toBeInTheDocument();
    });
  });

  it('shows a link to go back after successful verification', async () => {
    vi.mocked(apiModule.verifyEmail).mockResolvedValue(undefined);
    renderVerifyPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /go to linklater/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when no token is in the URL', async () => {
    renderVerifyPage('');

    await waitFor(() => {
      expect(
        screen.getByText(/no verification token found/i),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when verification fails', async () => {
    vi.mocked(apiModule.verifyEmail).mockRejectedValue(
      new Error('Token expired'),
    );
    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });

  it('shows a fallback error message when the error is not an Error instance', async () => {
    vi.mocked(apiModule.verifyEmail).mockRejectedValue('unknown failure');
    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByText('Verification failed.')).toBeInTheDocument();
    });
  });

  it('navigates home when the back button is clicked after an error', async () => {
    renderVerifyPage('');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to linklater/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to linklater/i }));
  });
});
