import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import AccountSettingsForm from './AccountSettingsForm';
import ApiTokensSection from './ApiTokensSection';
import BookmarkletSection from './BookmarkletSection';
import CvdModeToggle from './CvdModeToggle';
import DangerZone from './DangerZone';
import SettingsGroup from './SettingsGroup';
import SettingsLayout from './SettingsLayout';
import SocialLoginsSection from './SocialLoginsSection';
import StumbleSection from '../stumble/StumbleSection';
import TwoFactorSection from './TwoFactorSection';
import { useSettingsScrollSpy } from './useSettingsScrollSpy';
import type { SettingsSection } from './settingsSections';

interface SettingsViewProps {
  appleEnabled?: boolean;
  googleEnabled?: boolean;
}

const LINKED_MESSAGES: Record<string, string> = {
  google: 'Google account connected successfully.',
};

const LINK_ERROR_MESSAGES: Record<string, string> = {
  already_linked:
    'That account is already linked to another user. Try a different one.',
  email_mismatch:
    'That Google account uses a different email address. Use the Google account that matches your Linklater email.',
};

export default function SettingsView({
  appleEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true',
  googleEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true',
}: SettingsViewProps = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParameters, setSearchParameters] = useSearchParams();

  // Capture flash messages from query params on mount and store them in state
  // so they survive after the URL is cleaned up.
  const [linkedMessage] = useState<string | null>(() => {
    const provider = searchParameters.get('linked');
    return provider
      ? (LINKED_MESSAGES[provider] ?? `${provider} account connected.`)
      : null;
  });

  const [linkError] = useState<string | null>(() => {
    const errorCode = searchParameters.get('link_error');
    return errorCode
      ? (LINK_ERROR_MESSAGES[errorCode] ?? 'Failed to connect account.')
      : null;
  });

  // Clean the flash params from the URL so they don't reappear on refresh.
  useEffect(() => {
    if (searchParameters.get('linked') || searchParameters.get('link_error')) {
      setSearchParameters({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSocialLogins = googleEnabled || appleEnabled;
  const showSecurity = Boolean(user?.hasPassword);

  // Sections are derived from user state and feature flags. Order matches
  // the document order of the rendered groups; both the sidebar and the
  // scroll-spy hook depend on this.
  const sections = useMemo<SettingsSection[]>(() => {
    const list: SettingsSection[] = [
      { hash: 'account', label: 'Account', icon: 'fa-user' },
    ];
    if (showSecurity) {
      list.push({
        hash: 'security',
        label: 'Security',
        icon: 'fa-shield-halved',
      });
    }
    list.push({
      hash: 'accessibility',
      label: 'Accessibility',
      icon: 'fa-universal-access',
    });
    list.push({ hash: 'bookmarks', label: 'Bookmarks', icon: 'fa-book-open' });
    list.push({
      hash: 'integrations',
      label: 'Integrations',
      icon: 'fa-plug',
    });
    list.push({
      hash: 'danger',
      label: 'Danger',
      icon: 'fa-triangle-exclamation',
    });
    return list;
  }, [showSecurity]);

  const sectionIds = useMemo(
    () => sections.map((section) => section.hash),
    [sections],
  );

  const { activeHash, markIntent } = useSettingsScrollSpy({ sectionIds });

  // React Router does not auto-scroll to the URL hash on SPA navigation.
  // When something deep-links into a settings section (e.g. the WelcomeModal
  // buttons land on `/settings#bookmarklet`), scroll the section into view
  // and move focus to it so screen reader and keyboard users land where the
  // sighted user does. `prefers-reduced-motion` disables smooth scroll.
  useEffect(() => {
    if (!location.hash) return;
    const element = document.getElementById(location.hash.slice(1));
    if (!element) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    element.focus({ preventScroll: true });
  }, [location.hash]);

  return (
    <SettingsLayout
      sections={sections}
      activeHash={activeHash}
      onNavigate={markIntent}
    >
      <SettingsGroup
        id="account"
        title="Account"
        icon="fa-user"
        description="Manage your email address, password, and social logins."
        divided
      >
        <AccountSettingsForm />
        {showSocialLogins && (
          <SocialLoginsSection
            appleEnabled={!appleEnabled}
            googleEnabled={googleEnabled}
            linkedMessage={linkedMessage}
            linkError={linkError}
          />
        )}
      </SettingsGroup>

      {showSecurity && (
        <SettingsGroup
          id="security"
          title="Security"
          icon="fa-shield-halved"
          description="Set up multi-factor authentication and manage your recovery codes."
        >
          <TwoFactorSection />
        </SettingsGroup>
      )}

      <SettingsGroup
        id="accessibility"
        title="Accessibility"
        icon="fa-universal-access"
        description="Adjust how Linklater looks and feels."
      >
        <CvdModeToggle />
      </SettingsGroup>

      <SettingsGroup
        id="bookmarks"
        title="Browser bookmarks"
        icon="fa-book-open"
        description="Save and stumble upon links right from your web browser's bookmarks bar."
      >
        <BookmarkletSection />
        <StumbleSection />
      </SettingsGroup>

      <SettingsGroup
        id="integrations"
        title="Third-party integrations"
        icon="fa-plug"
        description="Use personal access tokens (PATs) to connect Linklater with external tools and services. Tokens are only shown once."
      >
        <ApiTokensSection />
      </SettingsGroup>

      <SettingsGroup
        id="danger"
        title="Danger zone"
        icon="fa-triangle-exclamation"
        description="Beware all ye who enter. Deleting your account will remove all your saved links. This cannot be undone."
        variant="danger"
      >
        <DangerZone />
      </SettingsGroup>
      <div className="flex items-center justify-center mt-100">
        <i
          className="fa-solid fa-cat text-[var(--text-subtle)]"
          aria-hidden="true"
        />
      </div>
    </SettingsLayout>
  );
}
