import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fillForm,
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

  it('moves focus to the alert again when the same submit fails twice', async () => {
    fillForm('different-password');
    await submitFromButton();

    await submitFromButton();

    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('replaces the alert message when the same submit fails twice', async () => {
    fillForm('different-password');
    await submitFromButton();
    const alert = screen.getByRole('alert');
    const firstMessage = alert.lastChild;

    await submitFromButton();

    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert.lastChild).not.toBe(firstMessage);
    expect(alert).toHaveTextContent('Passwords do not match.');
  });
});
