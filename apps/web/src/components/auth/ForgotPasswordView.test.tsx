/**
 * Tests for ForgotPasswordView.
 *
 * This is a pure presentational component; all behavior comes from
 * useAuthForm (tested separately). Wave 6 dropped the "Check your email"
 * interstitial branch — the form always renders, the success path fires a
 * toast via PendingNoticeAnnouncer and holds the submit button in a
 * "Reset link sent!" state for the toast's 3000ms window.
 *
 * Coverage:
 *   - Form (email input + submit button) always renders
 *   - No legacy interstitial copy/buttons
 *   - Submit button label/icon/disabled lifecycle:
 *       default → loading=true → forgotPasswordSentJustNow=true
 *   - Error display
 *   - Back-to-login link wired
 */

import ForgotPasswordView from './ForgotPasswordView';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { RefObject } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Props {
  email?: string;
  error?: string | null;
  forgotPasswordSentJustNow?: boolean;
  loading?: boolean;
  onBack?: () => void;
  onEmailChange?: (email: string) => void;
  onSubmit?: (event: React.FormEvent) => void;
}

function renderView(props: Props = {}) {
  const emailReference =
    createRef<HTMLInputElement | null>() as RefObject<HTMLInputElement | null>;
  const errorReference =
    createRef<HTMLParagraphElement | null>() as RefObject<HTMLParagraphElement | null>;

  return render(
    <ForgotPasswordView
      email={props.email ?? ''}
      emailReference={emailReference}
      error={props.error ?? null}
      errorReference={errorReference}
      forgotPasswordSentJustNow={props.forgotPasswordSentJustNow ?? false}
      loading={props.loading ?? false}
      onBack={props.onBack ?? vi.fn()}
      onEmailChange={props.onEmailChange ?? vi.fn()}
      onSubmit={props.onSubmit ?? vi.fn()}
    />,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForgotPasswordView always renders the form', () => {
  it('renders the email input in default state', () => {
    renderView();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('renders the email input even when forgotPasswordSentJustNow is true', () => {
    renderView({ forgotPasswordSentJustNow: true });
    // The form no longer collapses into a "Check your email" interstitial.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('does not render the legacy "Check your email for a reset link" interstitial copy', () => {
    renderView({ forgotPasswordSentJustNow: true });
    expect(
      screen.queryByText(/check your email for a reset link/i),
    ).not.toBeInTheDocument();
  });
});

describe('ForgotPasswordView error display', () => {
  it('shows error text inside a role="alert" element when error is provided', () => {
    renderView({ error: 'Email not recognized' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Email not recognized');
  });

  it('does not render an alert when error is null', () => {
    renderView({ error: null });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ForgotPasswordView back link', () => {
  it('calls onBack when the back-to-login link is clicked', () => {
    const onBack = vi.fn();
    renderView({ onBack });

    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));

    expect(onBack).toHaveBeenCalled();
  });
});

describe('ForgotPasswordView submit button — default state', () => {
  it('shows "Send password reset link" as the default label', () => {
    renderView();
    expect(
      screen.getByRole('button', { name: /send password reset link/i }),
    ).toBeInTheDocument();
  });

  it('renders the envelope icon in the default state', () => {
    const { container } = renderView();
    expect(container.querySelector('.fa-envelope')).toBeInTheDocument();
    expect(container.querySelector('.fa-circle-check')).not.toBeInTheDocument();
  });

  it('is enabled in the default state', () => {
    renderView();
    expect(
      screen.getByRole('button', { name: /send password reset link/i }),
    ).not.toBeDisabled();
  });
});

describe('ForgotPasswordView submit button — loading state', () => {
  it('keeps the envelope icon while loading (single envelope through the request)', () => {
    const { container } = renderView({ loading: true });
    expect(container.querySelector('.fa-envelope')).toBeInTheDocument();
    expect(container.querySelector('.fa-circle-check')).not.toBeInTheDocument();
  });

  it('is disabled while loading', () => {
    renderView({ loading: true });
    expect(
      screen.getByRole('button', { name: /send password reset link/i }),
    ).toBeDisabled();
  });
});

describe('ForgotPasswordView submit button — forgotPasswordSentJustNow state', () => {
  it('shows "Reset link sent!" as the label when forgotPasswordSentJustNow is true', () => {
    renderView({ forgotPasswordSentJustNow: true });
    expect(
      screen.getByRole('button', { name: /send password reset link/i }),
    ).toBeInTheDocument();
  });

  it('shows the envelope-open icon when forgotPasswordSentJustNow is true', () => {
    const { container } = renderView({ forgotPasswordSentJustNow: true });
    expect(container.querySelector('.fa-envelope-open')).toBeInTheDocument();
    expect(container.querySelector('.fa-envelope')).not.toBeInTheDocument();
  });

  it('disables the submit button during the success hold (prevents re-click during the toast window)', () => {
    renderView({ forgotPasswordSentJustNow: true });
    expect(
      screen.getByRole('button', { name: /send password reset link/i }),
    ).toBeDisabled();
  });
});
