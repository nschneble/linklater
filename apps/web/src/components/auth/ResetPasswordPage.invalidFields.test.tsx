import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmField,
  fillForm,
  newPasswordField,
  renderPage,
  submitFromButton,
  TOKEN_ERROR,
} from './ResetPasswordPage.testSetup';
import { screen } from '@testing-library/react';

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

beforeEach(() => {
  vi.clearAllMocks();
  renderPage();
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
    expect(newPasswordField()).not.toHaveAccessibleDescription();
  });

  it('clears the invalid mark once the passwords match', async () => {
    vi.mocked(apiModule.resetPassword).mockRejectedValue(TOKEN_ERROR);
    fillForm('different-password');
    await submitFromButton();
    expect(confirmField()).toHaveAttribute('aria-invalid', 'true');

    fillForm();
    await submitFromButton();

    expect(confirmField()).not.toHaveAttribute('aria-invalid');
    expect(confirmField()).not.toHaveAccessibleDescription();
    expect(newPasswordField()).not.toHaveAccessibleDescription();
  });
});
