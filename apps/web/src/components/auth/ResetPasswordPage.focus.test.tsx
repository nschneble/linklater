import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('../../lib/api', () => ({
  resetPassword: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ refreshUser: vi.fn() }),
}));

import * as apiModule from '../../lib/api';

const PASSWORD = 'correct-horse-battery';
const TOKEN_ERROR = new Error('Invalid or expired reset token.');

function confirmField() {
  return screen.getByLabelText(/confirm new password/i);
}

function newPasswordField() {
  return screen.getByLabelText(/^new password/i);
}

function fillForm(confirm = PASSWORD) {
  fireEvent.change(newPasswordField(), { target: { value: PASSWORD } });
  fireEvent.change(confirmField(), { target: { value: confirm } });
}

async function submitFromButton() {
  const submitButton = screen.getByRole('button', { name: /reset password/i });
  submitButton.focus();
  expect(submitButton).toHaveFocus();

  await act(async () => {
    fireEvent.submit(submitButton.closest('form')!);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  render(
    <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
});

describe('ResetPasswordPage focus', () => {
  it('moves focus to the loading screen on submit', async () => {
    vi.mocked(apiModule.resetPassword).mockReturnValue(new Promise(() => {}));
    fillForm();

    await submitFromButton();

    const main = screen.getByRole('main');
    expect(main).toHaveFocus();
    expect(main).not.toHaveAccessibleName();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('moves focus to the code input when the reset needs MFA', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaMethod: 'totp',
      mfaToken: 'mfa-token',
    });
    fillForm();

    await submitFromButton();

    expect(screen.getByLabelText('Authenticator code')).toHaveFocus();
  });

  it('moves focus to the alert when the reset fails', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue(TOKEN_ERROR);
    fillForm();

    await submitFromButton();

    expect(screen.getByRole('alert')).toHaveFocus();
  });
});

describe('ResetPasswordPage invalid fields', () => {
  it('marks the confirm field invalid when the passwords differ', async () => {
    fillForm('different-password');

    await submitFromButton();

    expect(screen.getByRole('alert')).toHaveFocus();
    expect(confirmField()).toHaveAttribute('aria-invalid', 'true');
    expect(confirmField()).toHaveAccessibleDescription(
      'Passwords do not match.',
    );
    expect(newPasswordField()).not.toHaveAttribute('aria-invalid');
  });

  it('clears the invalid mark once the passwords match', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue(TOKEN_ERROR);
    fillForm('different-password');
    await submitFromButton();
    expect(confirmField()).toHaveAttribute('aria-invalid', 'true');

    fillForm();
    await submitFromButton();

    expect(confirmField()).not.toHaveAttribute('aria-invalid');
    expect(confirmField()).toHaveAccessibleDescription(TOKEN_ERROR.message);
    expect(newPasswordField()).toHaveAccessibleDescription(TOKEN_ERROR.message);
  });
});
