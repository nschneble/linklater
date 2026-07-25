import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useFlashQueryParameters } from '../../lib/hooks/useFlashQueryParameters';
import { useToast } from '../../lib/hooks/useToast';
import { useToastAnnouncement } from '../../lib/hooks/useToastAnnouncement';
import Toast from '../common/Toast';
import StumbleSection from '../stumble/StumbleSection';
import AccountSettingsForm from './AccountSettingsForm';
import ApiTokensSection from './ApiTokensSection';
import BookmarkletSection from './BookmarkletSection';
import CvdModeToggle from './CvdModeToggle';
import DangerZone from './DangerZone';
import DyslexicFontToggle from './DyslexicFontToggle';
import IdPsSection from './IdPsSection';
import KeyboardShortcutsToggle from './KeyboardShortcutsToggle';
import MultiFactorSection from './MultiFactorSection';
import SettingsGroup from './SettingsGroup';
import SettingsLayout from './SettingsLayout';
import { LINK_ERROR_MESSAGES, LINKED_MESSAGES } from './oauthFlashMessages';
import { setActiveSettingsSection } from './settingsScroll';
import { useSettingsActiveSection } from './useSettingsActiveSection';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
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

  // Flash messages from `?linked=…` / `?link_error=…`. `useFlashQueryParameters`
  // owns the deferred-read + URL-strip dance (see its WHY block for the
  // SR-announce, no-deps, and StrictMode rationale). The hook returns
  // `null` synchronously on first paint, then the parsed flash once,
  // stable thereafter – preserving the empty → populated transition NVDA
  // and JAWS need to announce the Toast.
  const flash = useFlashQueryParameters(readOAuthFlashMessages, [
    'linked',
    'link_error',
  ]);
  const toast = useToast();
  // The visual Toast below is conditionally mounted, which lets NVDA/JAWS miss
  // its first announcement; the always-mounted sr-only region does the
  // announcing instead (Toast renders `announce={false}`).
  const toastAnnouncement = useToastAnnouncement(toast.message);
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    if (flash.toastMessage) toast.show(flash.toastMessage);
    if (flash.linkError) setLinkError(flash.linkError);
    // Run once when the flash settles. `toast` is a stable hook return
    // by construction; `flash` flips null → value exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  const showIdPs = googleEnabled || appleEnabled;

  // Sections are derived from user state and feature flags. Order matches
  // the document order of the rendered groups; the sidebar depends on this.
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

  // Clear the module-scope last-activated-section on unmount. Without this,
  // navigating away from /settings and back lands the user on whichever
  // section they last clicked: the React `activeSection` state resets on
  // remount, but `useReanchorOnLoad` reads from the module global, so async
  // leaves (PAT list, bookmarklet token) re-anchor scroll to the stale value
  // once they settle.
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
      {toast.message && (
        <Toast
          announce={false}
          message={toast.message}
          onDismiss={toast.dismiss}
        />
      )}

      {/*
        Always-mounted live region that announces in-session toast messages
        (e.g. "Google account connected."). The visual Toast above renders
        `announce={false}`, so this region is the sole announcer – a
        conditionally-mounted Toast can miss its first announcement.
      */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="toast-announcement"
      >
        {toastAnnouncement}
      </span>
    </SettingsLayout>
  );
}
