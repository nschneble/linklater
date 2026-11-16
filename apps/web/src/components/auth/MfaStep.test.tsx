import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import MfaStep from './MfaStep';
import { verifyOtp } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  verifyOtp: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ refreshUser: vi.fn() }),
}));

function clickWhileFocused(name: string) {
  const switchButton = screen.getByRole('button', { name });
  switchButton.focus();
  expect(switchButton).toHaveFocus();
  fireEvent.click(switchButton);
}

beforeEach(() => {
  render(
    <MemoryRouter>
      <MfaStep mfaMethod="totp" mfaToken="mfa-token" />
    </MemoryRouter>,
  );
});

describe('MfaStep focus', () => {
  it('focuses the code input on mount', () => {
    expect(screen.getByLabelText('Authenticator code')).toHaveFocus();
  });

  it('keeps focus on the code input when switching to a recovery code', () => {
    clickWhileFocused('Use a recovery code');

    expect(screen.getByLabelText('Recovery code')).toHaveFocus();
  });

  it('keeps focus on the code input when switching back', () => {
    clickWhileFocused('Use a recovery code');
    clickWhileFocused('Use a different method');

    expect(screen.getByLabelText('Authenticator code')).toHaveFocus();
  });

  it('moves focus to the error when the code is rejected', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error('Invalid code'));
    const codeInput = screen.getByLabelText('Authenticator code');
    expect(codeInput).toHaveFocus();

    await act(async () => {
      fireEvent.change(codeInput, { target: { value: '123456' } });
    });

    expect(screen.getByRole('alert')).toHaveFocus();
  });
});
