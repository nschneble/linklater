import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginRegisterView from './LoginRegisterView';

function renderView(modeOverride: 'login' | 'register' = 'login') {
  return render(
    <LoginRegisterView
      email=""
      emailReference={createRef<HTMLInputElement>()}
      error={null}
      loading={false}
      magicLinkSent={false}
      mode={modeOverride}
      onEmailChange={vi.fn()}
      onForgotPassword={vi.fn()}
      onMagicLinkBack={vi.fn()}
      onModeChange={vi.fn()}
      onPasswordChange={vi.fn()}
      onSubmit={vi.fn()}
      password=""
      passwordReference={createRef<HTMLInputElement>()}
    />,
  );
}

describe('LoginRegisterView', () => {
  it('wires the form as a tabpanel labelled by the active tab', () => {
    renderView('login');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'auth-tab-login');

    const loginTab = screen.getByRole('tab', { name: /log in/i });
    expect(loginTab).toHaveAttribute('id', 'auth-tab-login');
    expect(loginTab).toHaveAttribute('aria-controls', 'auth-form-panel');
    expect(panel).toHaveAttribute('id', 'auth-form-panel');
  });

  it('updates aria-labelledby when the active tab switches to register', () => {
    renderView('register');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'auth-tab-register');

    const registerTab = screen.getByRole('tab', { name: /sign up/i });
    expect(registerTab).toHaveAttribute('id', 'auth-tab-register');
  });
});
