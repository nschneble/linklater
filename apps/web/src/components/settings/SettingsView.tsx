import AccountSettingsForm from './AccountSettingsForm';
import ApiTokensSection from './ApiTokensSection';
import BookmarkletSection from './BookmarkletSection';
import CvdModeToggle from './CvdModeToggle';
import DangerZone from './DangerZone';
import DyslexicFontToggle from './DyslexicFontToggle';
import IdPsSection from './IdPsSection';
import KeyboardShortcutsToggle from './KeyboardShortcutsToggle';
import { LINK_ERROR_MESSAGES, LINKED_MESSAGES } from './oauthFlashMessages';
import MultiFactorSection from './MultiFactorSection';
import { setActiveSettingsSection } from './settingsScroll';
import SettingsGroup from './SettingsGroup';
import SettingsLayout from './SettingsLayout';
import StumbleSection from '../stumble/StumbleSection';
import ToastAnnouncer from '../common/ToastAnnouncer';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useMemo, useState } from 'react';
import { useFlashQueryParameters } from '../../lib/hooks/useFlashQueryParameters';
import { useLocation, useNavigate } from 'react-router';
import { useSettingsActiveSection } from './useSettingsActiveSection';
import { useToast } from '../../lib/hooks/useToast';
import type { SettingsSection } from './settingsSections';

interface FlashMessages {
  toastMessage: string | null;
  linkError: string | null;
}

function readOAuthFlashMessages(
  parameters: URLSearchParams,
): FlashMessages | null {
  const provider = parameters.get('linked');
  const errorCode = parameters.get('link_error');
  if (!provider && !errorCode) {
    return null;
  }
  return {
    toastMessage: provider
      ? (LINKED_MESSAGES[provider] ?? 'Account connected.')
      : null,
    linkError: errorCode
      ? (LINK_ERROR_MESSAGES[errorCode] ?? 'Failed to connect account.')
      : null,
  };
}

interface SettingsViewProps {
  appleEnabled?: boolean;
  googleEnabled?: boolean;
}

export default function SettingsView({
  appleEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true',
  googleEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true',
}: SettingsViewProps = {}) {
  useDocumentTitle('Linklater – Settings');

  const location = useLocation();
  const navigate = useNavigate();

  // hook returns null then the flash once, so SR announces the Toast
  const flash = useFlashQueryParameters(readOAuthFlashMessages, [
    'linked',
    'link_error',
  ]);
  const toast = useToast();
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    if (flash.toastMessage) toast.show(flash.toastMessage);
    if (flash.linkError) setLinkError(flash.linkError);
    // runs once: flash flips null→value once and toast is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  const showIdPs = googleEnabled || appleEnabled;

  // order must match the rendered groups; the sidebar relies on it
  const sections = useMemo<SettingsSection[]>(
    () => [
      { hash: 'account', label: 'Account', icon: 'fa-user' },
      { hash: 'security', label: 'Security', icon: 'fa-shield-halved' },
      {
        hash: 'accessibility',
        label: 'Accessibility',
        icon: 'fa-universal-access',
      },
      { hash: 'bookmarks', label: 'Bookmarks', icon: 'fa-book-open' },
      { hash: 'integrations', label: 'Integrations', icon: 'fa-plug' },
      { hash: 'danger', label: 'Danger', icon: 'fa-triangle-exclamation' },
    ],
    [],
  );

  const sectionIds = useMemo(
    () => sections.map((settingsSection) => settingsSection.hash),
    [sections],
  );

  const { activeSection, activateSection } = useSettingsActiveSection({
    sectionIds,
  });

  // honor a router-state scrollTo jump, then strip it so back won't repeat
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

  // clear module-scope section on unmount or async leaves re-anchor stale
  useEffect(() => {
    return () => {
      setActiveSettingsSection('');
    };
  }, []);

  return (
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
      >
        <AccountSettingsForm />
        {showIdPs && (
          <IdPsSection
            appleEnabled={appleEnabled}
            googleEnabled={googleEnabled}
            linkError={linkError}
          />
        )}
      </SettingsGroup>

      <SettingsGroup
        id="security"
        title="Enhanced security"
        icon="fa-shield-halved"
        description="Set up and manage multi-factor authentication. That's not overkill for a read-it-later app, right?"
        activeSection={activeSection}
      >
        <MultiFactorSection />
      </SettingsGroup>

      <SettingsGroup
        id="accessibility"
        title="Accessibility"
        icon="fa-universal-access"
        description="Adjust how Linklater looks and feels."
        activeSection={activeSection}
      >
        <div className="space-y-6">
          <CvdModeToggle />
          <DyslexicFontToggle />
          <KeyboardShortcutsToggle />
        </div>
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
      <div className="flex items-center justify-center mt-12">
        <i
          className="fa-solid fa-cat text-[var(--base-subtle-text)]"
          title="meow"
          aria-hidden="true"
        />
      </div>
      {/*
        In-session toast messages (e.g. "Google account connected."). See
        ToastAnnouncer's docstring for why the visual Toast renders
        `announce={false}` and an always-mounted mirror does the announcing.
      */}
      <ToastAnnouncer
        message={toast.message}
        onDismiss={toast.dismiss}
        testId="toast-announcement"
      />
    </SettingsLayout>
  );
}
