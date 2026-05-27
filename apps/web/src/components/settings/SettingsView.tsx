import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import AccountSettingsForm from './AccountSettingsForm';
import ApiTokensSection from './ApiTokensSection';
import BookmarkletSection from './BookmarkletSection';
import CvdModeToggle from './CvdModeToggle';
import DangerZone from './DangerZone';
import { EmailPrefillProvider } from './EmailPrefillContext';
import SettingsGroup from './SettingsGroup';
import SettingsLayout from './SettingsLayout';
import IdPsSection from './IdPsSection';
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
  unknown:
    'Something went wrong connecting that account. Please try again in a moment.',
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

  // Shared channel: IdPsSection pushes an email here when the user clicks
  // "Use … instead"; EmailSettingsForm picks it up via useEmailPrefill().
  // The token is bumped on every push so repeated clicks (e.g. same provider,
  // user re-clicks after dismissing) re-run the consumer's effect.
  const [emailPrefill, setEmailPrefill] = useState<{
    email: string | null;
    token: number;
  }>({ email: null, token: 0 });
  const handleUpdateAccountEmailTo = useCallback((email: string) => {
    setEmailPrefill((previous) => ({ email, token: previous.token + 1 }));
  }, []);
  const emailPrefillValue = useMemo(
    () => ({
      prefill: emailPrefill,
      setPrefillEmail: handleUpdateAccountEmailTo,
    }),
    [emailPrefill, handleUpdateAccountEmailTo],
  );

  // Clean the flash params from the URL so they don't reappear on refresh.
  useEffect(() => {
    if (searchParameters.get('linked') || searchParameters.get('link_error')) {
      setSearchParameters({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showIdPs = googleEnabled || appleEnabled;
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
    <EmailPrefillProvider value={emailPrefillValue}>
      <SettingsLayout
        sections={sections}
        activeHash={activeHash}
        onNavigate={markIntent}
      >
        <SettingsGroup
          id="account"
          title="Account"
          icon="fa-user"
          description="Manage your email address, password, and any identity providers (IdPs) you've connected."
          divided
        >
          <AccountSettingsForm />
          {showIdPs && (
            <IdPsSection
              appleEnabled={appleEnabled}
              googleEnabled={googleEnabled}
              linkedMessage={linkedMessage}
              linkError={linkError}
              onUpdateAccountEmailTo={handleUpdateAccountEmailTo}
            />
          )}
        </SettingsGroup>

        {showSecurity && (
          <SettingsGroup
            id="security"
            title="Security"
            icon="fa-shield-halved"
            description="Manage multi-factor authentication. That's not overkill for a read-it-later app, right?"
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
          description="Save and stumble upon links right from your bookmarks bar."
        >
          <BookmarkletSection />
          <StumbleSection />
        </SettingsGroup>

        <SettingsGroup
          id="integrations"
          title="Third-party integrations"
          icon="fa-plug"
          description="Use personal access tokens (PATs) to connect Linklater with external tools and services. Tokens allow you to access the Linklater API."
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
            title="meow"
            aria-hidden="true"
          />
        </div>
      </SettingsLayout>
    </EmailPrefillProvider>
  );
}
