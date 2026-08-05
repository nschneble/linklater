/**
 * Tests for IdPsSection.
 *
 * Scope after the inline success-Alert → Toast lift (toast now seeded by
 * SettingsView; see SettingsView.test.tsx for the deferred-announcement
 * contract). IdPsSection still owns:
 *   - `linkError` → inline `<Alert variant="error">`
 *   - `connectError` (local state set on connect-initiation failure) overrides
 *     `linkError` in the single error slot
 *   - Empty state: no error, no providers shown → returns null
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdPsSection from '.';
import { render, screen } from '@testing-library/react';
import type { User } from '../../../auth/AuthContext/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  initiateOAuthLink: vi.fn(),
  unlinkOAuthProvider: vi.fn(),
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuth } from '../../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    accountDeletionPending: false,
    connectedProviders: [],
    cvdMode: false,
    dyslexicFont: false,
    email: 'test@example.com',
    emailVerifiedAt: null,
    hasPassword: false,
    mode: 'light',
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    welcomedAt: null,
    ...overrides,
  };
}

function makeAuthContext(overrides: Partial<{ user: User | null }> = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    markWelcomed: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
    resendEmailChangeVerification: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: makeUser(),
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IdPsSection error rendering', () => {
  it('renders an inline error Alert when linkError is set', () => {
    render(
      <IdPsSection
        appleEnabled={false}
        googleEnabled={true}
        linkError="That account is already linked to another user."
      />,
    );

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert.textContent).toContain(
      'That account is already linked to another user.',
    );
  });

  it('renders no success element – toast is now owned by SettingsView', () => {
    const { container } = render(
      <IdPsSection
        appleEnabled={false}
        googleEnabled={true}
        linkError={null}
      />,
    );

    // [aria-live] guard catches a roleless aria-live div the role queries false-pass
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});

describe('IdPsSection empty state', () => {
  it('returns null when no provider is enabled or connected', () => {
    const { container } = render(
      <IdPsSection appleEnabled={false} googleEnabled={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the Google provider row when googleEnabled', () => {
    render(<IdPsSection appleEnabled={false} googleEnabled={true} />);
    // heading "Other ways to log in" is the section anchor
    expect(
      screen.getByRole('heading', { name: /other ways to log in/i }),
    ).toBeTruthy();
  });
});
