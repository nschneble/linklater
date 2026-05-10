import { MemoryRouter } from 'react-router-dom';
import VerifyEmailChangePage from './VerifyEmailChangePage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../lib/api', () => ({
  verifyEmailChange: vi.fn(),
}));

import * as apiModule from '../lib/api';

afterEach(() => vi.restoreAllMocks());

function renderPage(search = '?token=change-abc') {
  return render(
    <MemoryRouter initialEntries={[`/verify-email-change${search}`]}>
      <VerifyEmailChangePage />
    </MemoryRouter>,
  );
}

describe('VerifyEmailChangePage', () => {
  it('shows verifying state while the request is in flight', () => {
    vi.mocked(apiModule.verifyEmailChange).mockReturnValue(
      new Promise(() => {}),
    );
    renderPage();
    expect(screen.getByText(/confirming your new email/i)).toBeInTheDocument();
  });

  it('shows success state after email change is confirmed', async () => {
    vi.mocked(apiModule.verifyEmailChange).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/email has been updated/i)).toBeInTheDocument();
    });
  });

  it('shows a link to go to Linklater after successful confirmation', async () => {
    vi.mocked(apiModule.verifyEmailChange).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /go to linklater/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when no token is in the URL', async () => {
    renderPage('');

    await waitFor(() => {
      expect(
        screen.getByText(/no verification token found/i),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when verification fails', async () => {
    vi.mocked(apiModule.verifyEmailChange).mockRejectedValue(
      new Error('Token expired'),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });

  it('shows a fallback error message when the error is not an Error instance', async () => {
    vi.mocked(apiModule.verifyEmailChange).mockRejectedValue('unknown failure');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verification failed.')).toBeInTheDocument();
    });
  });

  it('navigates home when the back button is clicked after an error', async () => {
    renderPage('');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to linklater/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to linklater/i }));
  });
});
