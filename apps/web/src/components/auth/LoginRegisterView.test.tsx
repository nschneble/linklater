/**
 * Tests for LoginRegisterView.
 *
 * This is a pure presentational component; all behavior comes from
 * useAuthForm (tested separately). These tests verify:
 *   - Stable aria-describedby="auth-form-error" on both form fields (new
 *     always-mounted Alert pattern means the reference is never dangling)
 *   - Error text appears in the role="alert" element when provided
 *   - Magic-link-sent state renders the confirmation message
 *   - Mode-change tabs wire up correctly (login / sign up labels visible)
 *   - Forgot-password link present in login mode
 */

import LoginRegisterView from './LoginRegisterView';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { RefObject } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Props {
  email?: string;
  error?: string | null;
  loading?: boolean;
  magicLinkSent?: boolean;
  mode?: 'login' | 'register';
  password?: string;
  onEmailChange?: (email: string) => void;
  onForgotPassword?: () => void;
  onMagicLinkBack?: () => void;
  onModeChange?: (mode: 'login' | 'register') => void;
  onPasswordChange?: (password: string) => void;
  onSubmit?: (event: React.FormEvent) => void;
}

function renderView(props: Props = {}) {
  const emailReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;
  const errorReference =
    createRef<HTMLParagraphElement | null>() as RefObject<HTMLParagraphElement | null>;
  const passwordReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;

  return render(
    <LoginRegisterView
      email={props.email ?? ''}
      emailReference={emailReference}
      error={props.error ?? null}
      errorReference={errorReference}
      loading={props.loading ?? false}
      magicLinkSent={props.magicLinkSent ?? false}
      mode={props.mode ?? 'login'}
      onEmailChange={props.onEmailChange ?? vi.fn()}
      onForgotPassword={props.onForgotPassword ?? vi.fn()}
      onMagicLinkBack={props.onMagicLinkBack ?? vi.fn()}
      onModeChange={props.onModeChange ?? vi.fn()}
      onPasswordChange={props.onPasswordChange ?? vi.fn()}
      onSubmit={props.onSubmit ?? vi.fn()}
      password={props.password ?? ''}
      passwordReference={passwordReference}
    />,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginRegisterView stable aria-describedby', () => {
  it('email field always has aria-describedby="auth-form-error" even when no error', () => {
    renderView({ error: null });
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('aria-describedby', 'auth-form-error');
  });

  it('password field always has aria-describedby="auth-form-error" even when no error', () => {
    renderView({ error: null });
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute(
      'aria-describedby',
      'auth-form-error',
    );
  });

  it('email field keeps aria-describedby="auth-form-error" when an error is present', () => {
    renderView({ error: 'Invalid credentials' });
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('aria-describedby', 'auth-form-error');
  });

  it('password field keeps aria-describedby="auth-form-error" when an error is present', () => {
    renderView({ error: 'Invalid credentials' });
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute(
      'aria-describedby',
      'auth-form-error',
    );
  });
});

describe('LoginRegisterView error display', () => {
  it('shows error text inside a role="alert" element when error is provided', () => {
    renderView({ error: 'Invalid credentials' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid credentials');
  });

  it('alert element is always mounted (empty but in DOM) when there is no error', () => {
    renderView({ error: null });
    // The alert is mounted but aria-hidden=true and sr-only; it exists in DOM
    const errorElement = document.getElementById('auth-form-error');
    expect(errorElement).toBeInTheDocument();
  });
});

describe('LoginRegisterView mode tabs', () => {
  it('renders "Log in" and "Sign up" tab buttons', () => {
    renderView({ mode: 'login' });
    expect(screen.getByRole('tab', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('calls onModeChange with "register" when Sign up tab is clicked', () => {
    const onModeChange = vi.fn();
    renderView({ mode: 'login', onModeChange });

    fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));

    expect(onModeChange).toHaveBeenCalledWith('register');
  });

  it('calls onModeChange with "login" when Log in tab is clicked', () => {
    const onModeChange = vi.fn();
    renderView({ mode: 'register', onModeChange });

    fireEvent.click(screen.getByRole('tab', { name: 'Log in' }));

    expect(onModeChange).toHaveBeenCalledWith('login');
  });
});

describe('LoginRegisterView forgot password link', () => {
  it('renders the forgot password link in login mode', () => {
    renderView({ mode: 'login' });
    expect(
      screen.getByRole('button', {
        name: /i literally have no idea what my password is/i,
      }),
    ).toBeInTheDocument();
  });

  it('calls onForgotPassword when the link is clicked', () => {
    const onForgotPassword = vi.fn();
    renderView({ mode: 'login', onForgotPassword });

    fireEvent.click(
      screen.getByRole('button', {
        name: /i literally have no idea what my password is/i,
      }),
    );

    expect(onForgotPassword).toHaveBeenCalled();
  });
});

describe('LoginRegisterView magic-link-sent state', () => {
  it('shows "Check your email" confirmation in login mode after magic link sent', () => {
    renderView({ mode: 'login', magicLinkSent: true });
    expect(
      screen.getByText(/check your email for a login link/i),
    ).toBeInTheDocument();
  });

  it('shows "Check your email to complete signup" in register mode after magic link sent', () => {
    renderView({ mode: 'register', magicLinkSent: true });
    expect(
      screen.getByText(/check your email to complete signup/i),
    ).toBeInTheDocument();
  });

  it('shows "Back to login" button in magic-link-sent state', () => {
    renderView({ magicLinkSent: true });
    expect(
      screen.getByRole('button', { name: /back to login/i }),
    ).toBeInTheDocument();
  });

  it('"Back to login" button calls onMagicLinkBack', () => {
    const onMagicLinkBack = vi.fn();
    renderView({ magicLinkSent: true, onMagicLinkBack });

    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));

    expect(onMagicLinkBack).toHaveBeenCalled();
  });

  it('hides the form inputs in magic-link-sent state', () => {
    renderView({ magicLinkSent: true });
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});

describe('LoginRegisterView submit button', () => {
  it('shows "Log in" as submit label in login mode with a password typed', () => {
    renderView({ mode: 'login', password: 'secret' });
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows "Log in with magic link" when no password is typed in login mode', () => {
    renderView({ mode: 'login', password: '' });
    expect(
      screen.getByRole('button', { name: /log in with magic link/i }),
    ).toBeInTheDocument();
  });
});
