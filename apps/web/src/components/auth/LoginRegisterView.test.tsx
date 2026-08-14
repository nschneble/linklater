/**
 * Tests for LoginRegisterView.
 *
 * This is a pure presentational component; all behavior comes from
 * useAuthForm (tested separately). These tests verify:
 *   - Stable aria-describedby="auth-form-error" on both form fields (new
 *     always-mounted Alert pattern means the reference is never dangling)
 *   - Error text appears in the role="alert" element when provided
 *   - The form always renders; no interstitial branch
 *   - Mode-change tabs wire up correctly (login / sign up labels visible)
 *   - Forgot-password link present in login mode
 *   - Privacy policy link present in register mode, navigating to /privacy
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LoginRegisterView from './LoginRegisterView';
import type { RefObject } from 'react';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Props {
  announceError?: boolean;
  email?: string;
  error?: string | null;
  loading?: boolean;
  magicLinkSentJustNow?: boolean;
  mode?: 'login' | 'register';
  password?: string;
  onEmailChange?: (email: string) => void;
  onForgotPassword?: () => void;
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
      announceError={props.announceError ?? true}
      email={props.email ?? ''}
      emailReference={emailReference}
      error={props.error ?? null}
      errorReference={errorReference}
      loading={props.loading ?? false}
      magicLinkSentJustNow={props.magicLinkSentJustNow ?? false}
      mode={props.mode ?? 'login'}
      onEmailChange={props.onEmailChange ?? vi.fn()}
      onForgotPassword={props.onForgotPassword ?? vi.fn()}
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
    // sr-only and empty, but registered ahead of the text that fills it
    const errorElement = document.getElementById('auth-form-error');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  // an error that arrived on the URL is announced by AuthForm's own region
  it('paints the error without a live region when announceError is false', () => {
    renderView({ announceError: false, error: 'Invalid credentials' });
    const errorElement = document.getElementById('auth-form-error');
    expect(errorElement).toHaveTextContent('Invalid credentials');
    expect(errorElement).not.toHaveAttribute('role');
    expect(screen.queryByRole('alert')).toBeNull();
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

describe('LoginRegisterView privacy policy link', () => {
  it('renders the privacy policy link in register mode', () => {
    renderView({ mode: 'register' });
    expect(
      screen.getByRole('button', { name: /read our privacy policy/i }),
    ).toBeInTheDocument();
  });

  it('navigates to /privacy when the link is clicked', () => {
    renderView({ mode: 'register' });

    fireEvent.click(
      screen.getByRole('button', { name: /read our privacy policy/i }),
    );

    expect(navigate).toHaveBeenCalledWith('/privacy');
  });

  it('does not render the privacy policy link in login mode', () => {
    renderView({ mode: 'login' });
    expect(
      screen.queryByRole('button', { name: /read our privacy policy/i }),
    ).not.toBeInTheDocument();
  });
});

describe('LoginRegisterView always renders the form', () => {
  it('renders the email and password inputs in login mode', () => {
    renderView({ mode: 'login' });
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the email and password inputs in register mode', () => {
    renderView({ mode: 'register' });
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('does not render the legacy "Back to login" interstitial button', () => {
    renderView({ mode: 'login' });
    expect(
      screen.queryByRole('button', { name: /back to login/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render the legacy "Check your email" interstitial copy', () => {
    renderView({ mode: 'login' });
    expect(
      screen.queryByText(/check your email for a login link/i),
    ).not.toBeInTheDocument();
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

describe('LoginRegisterView magic-link success state', () => {
  it('shows the wand-magic-sparkles icon when magicLinkSentJustNow is true', () => {
    const { container } = renderView({
      mode: 'login',
      password: '',
      magicLinkSentJustNow: true,
    });
    expect(
      container.querySelector('.fa-wand-magic-sparkles'),
    ).toBeInTheDocument();
    expect(container.querySelector('.fa-wand-magic')).not.toBeInTheDocument();
  });

  it('disables the submit button while magicLinkSentJustNow is true (prevents re-click during toast window)', () => {
    renderView({ mode: 'login', password: '', magicLinkSentJustNow: true });
    const button = screen.getByRole('button', {
      name: /log in with magic link/i,
    });
    expect(button).toBeDisabled();
  });
});
