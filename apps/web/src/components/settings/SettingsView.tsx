import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import AccountSettingsForm from './AccountSettingsForm';
import ApiTokensSection from './ApiTokensSection';
import BookmarkletSection from './BookmarkletSection';
import CvdModeToggle from './CvdModeToggle';
import DangerZone from './DangerZone';
import SettingsGroup from './SettingsGroup';
import SettingsLayout from './SettingsLayout';
import IdPsSection from './IdPsSection';
import StumbleSection from '../stumble/StumbleSection';
import MultiFactorSection from './MultiFactorSection';
import Toast from '../common/Toast';
import { setActiveSettingsSection } from './settingsScroll';
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
  useDocumentTitle('Settings — Linklater');

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParameters, setSearchParameters] = useSearchParams();

  // Flash messages from `?linked=…` / `?link_error=…`. The success path
  // surfaces as a `<Toast>` (this view owns it) and the error path passes
  // down to `<IdPsSection>` as an inline `<Alert>`.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Read the flash params, derive their messages, then strip them from the
  // URL — all in a single mount-effect. Deferring the success read to an
  // effect (rather than reading synchronously in a `useState` initializer)
  // produces the empty → populated transition that NVDA/JAWS need to
  // announce the Toast's `aria-live="polite"` region; content present on
  // first paint is treated as page load and skipped. Same rationale as
  // `usePendingNotice`.
  useEffect(() => {
    const provider = searchParameters.get('linked');
    if (provider) {
      setToastMessage(
        LINKED_MESSAGES[provider] ?? `${provider} account connected.`,
      );
    }
    const errorCode = searchParameters.get('link_error');
    if (errorCode) {
      setLinkError(
        LINK_ERROR_MESSAGES[errorCode] ?? 'Failed to connect account.',
      );
    }
    if (provider || errorCode) {
      setSearchParameters({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="flex items-center justify-center mt-12">
        <i
          className="fa-solid fa-cat text-[var(--base-subtle-text)]"
          title="meow"
          aria-hidden="true"
        />
      </div>
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </SettingsLayout>
  );
}
