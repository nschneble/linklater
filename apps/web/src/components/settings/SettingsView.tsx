import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
import MultiFactorSection from './MultiFactorSection';
import { useSettingsActiveSection } from './useSettingsActiveSection';
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
  const navigate = useNavigate();
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
  // the document order of the rendered groups; the sidebar depends on this.
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
    () => sections.map((settingsSection) => settingsSection.hash),
    [sections],
  );

  const { activeSection, activateSection } = useSettingsActiveSection({
    sectionIds,
  });

  // Honor a router-state `scrollTo` jump (e.g. the welcome modal linking to
  // the bookmarks section). On arrival, activate + scroll to the target, then
  // strip the state so a refresh or back navigation doesn't re-trigger it.
  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (scrollTo && sectionIds.includes(scrollTo)) {
      activateSection(scrollTo);
    }
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <EmailPrefillProvider value={emailPrefillValue}>
      <SettingsLayout
        sections={sections}
        activeSection={activeSection}
        onSelectSection={activateSection}
      >
        <SettingsGroup
          id="account"
          title="Account"
          icon="fa-user"
          description="Manage your email address, password, and any identity providers (IdPs) you've connected."
          activeSection={activeSection}
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
            title="Enhanced security"
            icon="fa-shield-halved"
            description="Set up and manage multi-factor authentication. That's not overkill for a read-it-later app, right?"
            activeSection={activeSection}
          >
            <MultiFactorSection />
          </SettingsGroup>
        )}

        <SettingsGroup
          id="accessibility"
          title="Accessibility"
          icon="fa-universal-access"
          description="Adjust how Linklater looks and feels."
          activeSection={activeSection}
        >
          <CvdModeToggle />
        </SettingsGroup>

        <SettingsGroup
          id="bookmarks"
          title="Browser bookmarks"
          icon="fa-book-open"
          description="Save and stumble upon links right from your bookmarks bar."
          activeSection={activeSection}
        >
          <BookmarkletSection />
          <StumbleSection />
        </SettingsGroup>

        <SettingsGroup
          id="integrations"
          title="Third-party integrations"
          icon="fa-plug"
          description="Use personal access tokens (PATs) to connect Linklater with external tools and services."
          activeSection={activeSection}
        >
          <ApiTokensSection />
        </SettingsGroup>

        <SettingsGroup
          id="danger"
          title="Danger zone"
          icon="fa-triangle-exclamation"
          description="Beware all ye who enter. Deleting your account will remove all your saved links. This cannot be undone."
          variant="danger"
          activeSection={activeSection}
        >
          <DangerZone />
        </SettingsGroup>
        <div className="flex items-center justify-center mt-500">
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
