/**
 * Tests for ResetPasswordPage.
 *
 * State machine: form → (loading) → success | error
 * Token-from-URL paths:
 *   - No token → client-side error before API call
 *   - Password mismatch → client-side error before API call
 *   - API success → success view
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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';

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

  it('transitions to success view after a successful reset', async () => {
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
      expect(
        screen.getByRole('button', { name: /i'd like to log in now/i }),
      ).toBeInTheDocument();
    });
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
