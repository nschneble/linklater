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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LoginRegisterView from './LoginRegisterView';
import { restoreLocation, standOnPath } from '../../../test/locationMock';
import userEvent from '@testing-library/user-event';
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
  appleSsoEnabled?: boolean;
  email?: string;
  error?: string | null;
  googleSsoEnabled?: boolean;
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

function makeView(props: Props = {}) {
  const emailReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;
  const errorReference =
    createRef<HTMLParagraphElement | null>() as RefObject<HTMLParagraphElement | null>;
  const passwordReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;

  return (
    <LoginRegisterView
      announceError={props.announceError ?? true}
      appleSsoEnabled={props.appleSsoEnabled ?? false}
      email={props.email ?? ''}
      emailReference={emailReference}
      error={props.error ?? null}
      errorReference={errorReference}
      googleSsoEnabled={props.googleSsoEnabled ?? false}
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
    />
  );
}

function renderView(props: Props = {}) {
  return render(makeView(props));
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

  // counterpart to the old toBeDisabled check, minus the dropped focus
  it('refuses a re-click while magicLinkSentJustNow is true without going natively disabled', () => {
    renderView({ mode: 'login', password: '', magicLinkSentJustNow: true });
    const button = screen.getByRole('button', {
      name: /log in with magic link/i,
    });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('LoginRegisterView while a submit is in flight', () => {
  it('keeps focus inside the card when the submit goes busy', async () => {
    const user = userEvent.setup();
    const { rerender } = renderView({
      googleSsoEnabled: true,
      password: 'secret',
    });
    screen.getByRole('button', { name: 'Log in' }).focus();

    rerender(
      makeView({ googleSsoEnabled: true, loading: true, password: 'secret' }),
    );
    await user.tab();

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /continue with google/i }),
    );
  });

  it('leaves the submit focusable and marks it aria-disabled instead', () => {
    renderView({ loading: true, password: 'secret' });
    const submit = screen.getByRole('button', { name: 'Log in' });
    expect(submit).not.toBeDisabled();
    expect(submit).toHaveAttribute('aria-disabled', 'true');
  });

  // aria-busy would tell a reader to defer the error that ends this wait
  it('never asks a reader to defer the submit button', () => {
    renderView({ loading: true, password: 'secret' });
    expect(screen.getByRole('button', { name: 'Log in' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('marks the submit data-busy while loading but not on the magic-link pause', () => {
    const { rerender } = renderView({ loading: true, password: 'secret' });
    expect(screen.getByRole('button', { name: 'Log in' })).toHaveAttribute(
      'data-busy',
    );

    rerender(makeView({ magicLinkSentJustNow: true, password: '' }));
    expect(
      screen.getByRole('button', { name: /log in with magic link/i }),
    ).not.toHaveAttribute('data-busy');
  });

  /*
   * The pause after a send is neither of the states the primitive already
   * knows. Nothing is in flight, so the progress cursor would lie; and the
   * press landed, so the dim that says "unavailable" is the wrong signal
   * for a button the user just succeeded with — the same judgement
   * `theme/styles/cvdDisabled.test.ts` records for the CVD hatch.
   */
  it('names the magic-link pause a cooldown, which is neither busy nor unavailable', () => {
    const { rerender } = renderView({
      magicLinkSentJustNow: true,
      password: '',
    });
    const cooling = screen.getByRole('button', {
      name: /log in with magic link/i,
    });
    expect(cooling).toHaveAttribute('data-cooldown');
    expect(cooling).not.toHaveAttribute('data-busy');

    rerender(makeView({ loading: true, password: 'secret' }));
    expect(screen.getByRole('button', { name: 'Log in' })).not.toHaveAttribute(
      'data-cooldown',
    );
  });

  it('makes both inputs read-only rather than disabled', () => {
    renderView({ loading: true });
    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);

    expect(email).toHaveAttribute('readonly');
    expect(email).not.toBeDisabled();
    expect(password).toHaveAttribute('readonly');
    expect(password).not.toBeDisabled();
  });

  it('swallows typing into the read-only password field', async () => {
    const user = userEvent.setup();
    const onPasswordChange = vi.fn();
    renderView({ loading: true, onPasswordChange, password: 'secret' });

    await user.type(screen.getByLabelText(/password/i), 'MORE');

    expect(onPasswordChange).not.toHaveBeenCalled();
  });

  // a 5s lockout with no way to shorten it is a content-imposed time limit
  it('leaves the inputs writable through the magic-link pause', () => {
    renderView({ magicLinkSentJustNow: true });
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText(/password/i)).not.toHaveAttribute('readonly');
  });

  it('keeps the tabs arrow-navigable while refusing the mode change', () => {
    const onModeChange = vi.fn();
    renderView({ loading: true, onModeChange });
    const login = screen.getByRole('tab', { name: 'Log in' });
    const signup = screen.getByRole('tab', { name: 'Sign up' });

    login.focus();
    fireEvent.keyDown(login, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(signup);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('ignores a click on a tab', () => {
    const onModeChange = vi.fn();
    renderView({ loading: true, onModeChange });

    fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));

    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('ignores a click on the forgot-password link', () => {
    const onForgotPassword = vi.fn();
    renderView({ loading: true, onForgotPassword });

    fireEvent.click(
      screen.getByRole('button', {
        name: /i literally have no idea what my password is/i,
      }),
    );

    expect(onForgotPassword).not.toHaveBeenCalled();
  });
});

describe('LoginRegisterView single sign-on buttons', () => {
  beforeEach(() => {
    standOnPath('/login');
  });

  afterEach(() => {
    restoreLocation();
  });

  it('renders neither provider when both are switched off', () => {
    renderView({});
    expect(
      screen.queryByRole('button', { name: /continue with google/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue with apple/i }),
    ).not.toBeInTheDocument();
  });

  it('renders both providers when both are switched on', () => {
    renderView({ appleSsoEnabled: true, googleSsoEnabled: true });
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with apple/i }),
    ).toBeInTheDocument();
  });

  it('sends an idle user to the provider endpoint', () => {
    renderView({ googleSsoEnabled: true });

    fireEvent.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(window.location.href).toContain('/auth/google');
  });

  it('marks the providers aria-disabled and ignores their clicks while loading', () => {
    renderView({ googleSsoEnabled: true, loading: true });
    const google = screen.getByRole('button', {
      name: /continue with google/i,
    });

    expect(google).not.toBeDisabled();
    expect(google).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(google);

    expect(window.location.href).not.toContain('/auth/google');
  });
});
