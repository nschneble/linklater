import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import MfaStep from './MfaStep';

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
});
