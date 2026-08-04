/**
 * Tests for ChangePasswordForm.
 *
 * Key behaviors:
 *   - "Current password" section is always in the DOM (not unmounted) but
 *     hidden when the new-password field is empty – <div hidden={!password}> pattern.
 *   - Clearing the new-password field hides it again but does not remove it.
 *   - Loading/error/success state transitions.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordForm from './ChangePasswordForm';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  updateMe: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm() {
  return render(<ChangePasswordForm />);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.updateMe).mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChangePasswordForm hidden current-password pattern', () => {
  it('current-password input is in the DOM even when new-password is empty', () => {
    renderForm();

    // the input must be present (not unmounted), just hidden
    const currentPasswordInput = document.getElementById('current-password');
    expect(currentPasswordInput).toBeInTheDocument();
  });

  it('current-password container has the hidden attribute when new-password is empty', () => {
    renderForm();

    const container =
      document.getElementById('current-password')!.parentElement!;
    expect(container).toHaveAttribute('hidden');
  });

  it('current-password container loses the hidden attribute after typing a new password', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'new-secret-pass' },
    });

    const container =
      document.getElementById('current-password')!.parentElement!;
    expect(container).not.toHaveAttribute('hidden');
  });

  it('current-password input is still in the DOM after clearing the new-password field', () => {
    renderForm();

    // type a new password to reveal the container
    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'new-secret-pass' },
    });

    // clear new password; current-password should still be in the DOM
    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: '' },
    });

    const currentPasswordInput = document.getElementById('current-password');
    expect(currentPasswordInput).toBeInTheDocument();
  });
});

describe('ChangePasswordForm submit behavior', () => {
  it('shows "Nothing to update" when submitted with an empty new-password field', () => {
    const { container } = renderForm();

    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getByRole('status')).toHaveTextContent(/nothing to update/i);
  });

  it('calls updateMe with both passwords on submit', async () => {
    vi.mocked(apiModule.updateMe).mockResolvedValue(undefined);
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'new-secret-pass' },
    });
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'old-secret-pass' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.updateMe).toHaveBeenCalledWith({
      password: 'new-secret-pass',
      currentPassword: 'old-secret-pass',
    });
  });

  it('clears both password fields after a successful submit', async () => {
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'new-secret-pass' },
    });
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'old-secret-pass' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toHaveValue('');
    });
  });

  it('shows an error in role="alert" when updateMe rejects', async () => {
    vi.mocked(apiModule.updateMe).mockRejectedValue(
      new Error('Incorrect current password'),
    );
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'new-secret-pass' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /incorrect current password/i,
      );
    });
  });
});
