import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SettingsView from './SettingsView';
import type { User } from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
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

vi.mock('./MultiFactorSection', () => ({
  default: () => <div data-testid="multi-factor-section" />,
}));

vi.mock('./IdPsSection', () => ({
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
    multiFactorMethod: null,
    multiFactorPending: false,
    userId: USER_ID,
    welcomedAt: null,
    ...overrides,
  };
}

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    markWelcomed: vi.fn(),
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
  scrollTo?: string;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
}

function renderSettingsView({
  route = '/settings',
  scrollTo,
  googleEnabled = false,
  appleEnabled = false,
}: RenderOptions = {}) {
  // Plain strings let MemoryRouter parse query params (used by the OAuth flash
  // tests). The router-state `scrollTo` jump needs an object entry.
  const entry = scrollTo ? { pathname: route, state: { scrollTo } } : route;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/settings"
          element={
            <SettingsView
              googleEnabled={googleEnabled}
              appleEnabled={appleEnabled}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  Element.prototype.scrollIntoView = vi.fn();
  // Stub a non-zero document offset on every element. The scroll helper
  // snaps to the top of the page (window.scrollTo) when a section's natural
  // offset sits within its own scroll-margin — the jsdom default of 0,0
  // would push every test through that branch. A large top keeps these
  // tests on the standard `scrollIntoView` path; the snap-to-0 branch is
  // covered in `settingsScroll.test.ts`.
  Element.prototype.getBoundingClientRect = () =>
    ({
      top: 1000,
      bottom: 1100,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
    }) as DOMRect;
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

  describe('settings groups', () => {
    it('renders the account group anchor', () => {
      renderSettingsView();
      expect(document.getElementById('account')).not.toBeNull();
    });

    it('renders the accessibility group anchor', () => {
      renderSettingsView();
      expect(document.getElementById('accessibility')).not.toBeNull();
    });

    it('renders the bookmarks group anchor', () => {
      renderSettingsView();
      expect(document.getElementById('bookmarks')).not.toBeNull();
    });

    it('renders the integrations group anchor', () => {
      renderSettingsView();
      expect(document.getElementById('integrations')).not.toBeNull();
    });

    it('renders the danger group anchor', () => {
      renderSettingsView();
      expect(document.getElementById('danger')).not.toBeNull();
    });

    it('renders the security group anchor when user has password', () => {
      renderSettingsView();
      expect(document.getElementById('security')).not.toBeNull();
    });

    it('omits the security group when user has no password', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ hasPassword: false }) }),
      );
      renderSettingsView();
      expect(document.getElementById('security')).toBeNull();
    });
  });

  describe('MFA section', () => {
    it('shows the MultiFactor section when the user has a password', () => {
      renderSettingsView();
      expect(screen.getByTestId('multi-factor-section')).toBeInTheDocument();
    });

    it('hides the MultiFactor section when the user has no password', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ hasPassword: false }) }),
      );
      renderSettingsView();
      expect(
        screen.queryByTestId('multi-factor-section'),
      ).not.toBeInTheDocument();
    });
  });

  describe('IdPs section', () => {
    it('shows the IdPs section when googleEnabled is true', () => {
      renderSettingsView({ googleEnabled: true });
      expect(screen.getByTestId('social-logins-section')).toBeInTheDocument();
    });

    it('shows the IdPs section when appleEnabled is true', () => {
      renderSettingsView({ appleEnabled: true });
      expect(screen.getByTestId('social-logins-section')).toBeInTheDocument();
    });

    it('hides the IdPs section when neither provider is enabled', () => {
      renderSettingsView({ googleEnabled: false, appleEnabled: false });
      expect(
        screen.queryByTestId('social-logins-section'),
      ).not.toBeInTheDocument();
    });
  });

  describe('router-state scrollTo jump', () => {
    it('scrolls and focuses the bookmarks group when arriving with scrollTo=bookmarks', () => {
      renderSettingsView({ scrollTo: 'bookmarks' });
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      );
      expect(document.activeElement?.id).toBe('bookmarks');
    });

    it('scrolls and focuses the integrations group when arriving with scrollTo=integrations', () => {
      renderSettingsView({ scrollTo: 'integrations' });
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      );
      expect(document.activeElement?.id).toBe('integrations');
    });

    it('does not perform a section-driven scroll without a scrollTo state', () => {
      renderSettingsView();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      );
    });

    it('ignores a scrollTo that is not a known section id', () => {
      renderSettingsView({ scrollTo: 'bookmarklet' });
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      );
    });
  });

  describe('OAuth redirect flash messages', () => {
    it('passes linked=google as a linkedMessage to IdPsSection', () => {
      renderSettingsView({
        route: '/settings?linked=google',
        googleEnabled: true,
      });
      expect(screen.getByTestId('linked-message')).toHaveTextContent(
        /google.*connected/i,
      );
    });

    it('passes link_error=already_linked as a linkError to IdPsSection', () => {
      renderSettingsView({
        route: '/settings?link_error=already_linked',
        googleEnabled: true,
      });
      expect(screen.getByTestId('link-error')).toHaveTextContent(
        /already linked/i,
      );
    });

    it('passes a generic linkError for unrecognized link_error codes', () => {
      renderSettingsView({
        route: '/settings?link_error=unknown_code',
        googleEnabled: true,
      });
      expect(screen.getByTestId('link-error')).toHaveTextContent(
        /failed to connect/i,
      );
    });

    it('does not surface email_mismatch (no longer a behavior)', () => {
      renderSettingsView({
        route: '/settings?link_error=email_mismatch',
        googleEnabled: true,
      });
      expect(screen.getByTestId('link-error')).not.toHaveTextContent(
        /different email/i,
      );
    });
  });
});
