import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SettingsView from './SettingsView';
import type { User } from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./AccountSettingsForm', () => ({
  default: () => <div data-testid="account-settings-form" />,
}));

vi.mock('./ApiTokensSection', () => ({
  default: () => <div data-testid="api-tokens-section" />,
}));

vi.mock('./BookmarkletSection', () => ({
  default: () => (
    <div id="bookmarklet" tabIndex={-1} data-testid="bookmarklet-section" />
  ),
}));

vi.mock('./CvdModeToggle', () => ({
  default: () => <div data-testid="cvd-mode-toggle" />,
}));

vi.mock('./DangerZone', () => ({
  default: () => <div data-testid="danger-zone" />,
}));

vi.mock('../stumble/StumbleSection', () => ({
  default: () => (
    <div id="stumble" tabIndex={-1} data-testid="stumble-section" />
  ),
}));

vi.mock('./TwoFactorSection', () => ({
  default: () => <div data-testid="two-factor-section" />,
}));

vi.mock('./SocialLoginsSection', () => ({
  default: ({
    linkedMessage,
    linkError,
  }: {
    linkedMessage?: string | null;
    linkError?: string | null;
  }) => (
    <div data-testid="social-logins-section">
      {linkedMessage && (
        <span data-testid="linked-message">{linkedMessage}</span>
      )}
      {linkError && <span data-testid="link-error">{linkError}</span>}
    </div>
  ),
}));

import { useAuth } from '../../auth/AuthContext';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    cvdMode: false,
    connectedProviders: [],
    email: USER_EMAIL,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    hasPassword: true,
    mode: 'light',
    pendingEmail: null,
    theme: 'scanner-darkly',
    twoFactorMethod: null,
    twoFactorPending: false,
    userId: USER_ID,
    ...overrides,
  };
}

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: makeUser(),
    ...overrides,
  };
}

interface RenderOptions {
  route?: string;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
}

function renderSettingsView({
  route = '/settings',
  googleEnabled = false,
  appleEnabled = false,
}: RenderOptions = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SettingsView googleEnabled={googleEnabled} appleEnabled={appleEnabled} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

afterEach(() => vi.restoreAllMocks());

describe('SettingsView', () => {
  it('always renders the API Tokens section', () => {
    renderSettingsView();
    expect(screen.getByTestId('api-tokens-section')).toBeInTheDocument();
  });

  it('always renders the CVD mode toggle', () => {
    renderSettingsView();
    expect(screen.getByTestId('cvd-mode-toggle')).toBeInTheDocument();
  });

  describe('2FA section', () => {
    it('shows the TwoFactor section when the user has a password', () => {
      renderSettingsView();
      expect(screen.getByTestId('two-factor-section')).toBeInTheDocument();
    });

    it('hides the TwoFactor section when the user has no password', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ hasPassword: false }) }),
      );
      renderSettingsView();
      expect(
        screen.queryByTestId('two-factor-section'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Social logins section', () => {
    it('shows the SocialLogins section when googleEnabled is true', () => {
      renderSettingsView({ googleEnabled: true });
      expect(screen.getByTestId('social-logins-section')).toBeInTheDocument();
    });

    it('shows the SocialLogins section when appleEnabled is true', () => {
      renderSettingsView({ appleEnabled: true });
      expect(screen.getByTestId('social-logins-section')).toBeInTheDocument();
    });

    it('hides the SocialLogins section when neither provider is enabled', () => {
      renderSettingsView({ googleEnabled: false, appleEnabled: false });
      expect(
        screen.queryByTestId('social-logins-section'),
      ).not.toBeInTheDocument();
    });
  });

  describe('hash deep-linking', () => {
    it('scrolls and focuses the bookmarklet section when route includes #bookmarklet', () => {
      const scrollSpy = vi.fn();
      Element.prototype.scrollIntoView = scrollSpy;

      renderSettingsView({ route: '/settings#bookmarklet' });

      const section = screen.getByTestId('bookmarklet-section');
      expect(scrollSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(section);
    });

    it('scrolls and focuses the stumble section when route includes #stumble', () => {
      const scrollSpy = vi.fn();
      Element.prototype.scrollIntoView = scrollSpy;

      renderSettingsView({ route: '/settings#stumble' });

      const section = screen.getByTestId('stumble-section');
      expect(scrollSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(section);
    });

    it('does not scroll or move focus when route has no hash', () => {
      const scrollSpy = vi.fn();
      Element.prototype.scrollIntoView = scrollSpy;

      renderSettingsView({ route: '/settings' });

      expect(scrollSpy).not.toHaveBeenCalled();
    });
  });

  describe('OAuth redirect flash messages', () => {
    it('passes linked=google as a linkedMessage to SocialLoginsSection', () => {
      renderSettingsView({
        route: '/settings?linked=google',
        googleEnabled: true,
      });
      expect(screen.getByTestId('linked-message')).toHaveTextContent(
        /google.*connected/i,
      );
    });

    it('passes link_error=already_linked as a linkError to SocialLoginsSection', () => {
      renderSettingsView({
        route: '/settings?link_error=already_linked',
        googleEnabled: true,
      });
      expect(screen.getByTestId('link-error')).toHaveTextContent(
        /already linked/i,
      );
    });

    it('passes link_error=email_mismatch as a linkError to SocialLoginsSection', () => {
      renderSettingsView({
        route: '/settings?link_error=email_mismatch',
        googleEnabled: true,
      });
      expect(screen.getByTestId('link-error')).toHaveTextContent(
        /different email/i,
      );
    });
  });
});
