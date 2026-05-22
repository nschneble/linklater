import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import AccountSettingsForm from './AccountSettingsForm';
import ApiTokensSection from './ApiTokensSection';
import BookmarkletSection from './BookmarkletSection';
import CvdModeToggle from './CvdModeToggle';
import DangerZone from './DangerZone';
import SocialLoginsSection from './SocialLoginsSection';
import StumbleSection from '../stumble/StumbleSection';
import TwoFactorSection from './TwoFactorSection';

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

  const showSocialLogins = googleEnabled || appleEnabled;

  return (
    <div className="space-y-8">
      <AccountSettingsForm />
      {showSocialLogins && (
        <SocialLoginsSection
          linkedMessage={linkedMessage}
          linkError={linkError}
        />
      )}
      {user?.hasPassword && <TwoFactorSection />}
      <CvdModeToggle />
      <BookmarkletSection />
      <ApiTokensSection />
      <StumbleSection />
      <DangerZone />
    </div>
  );
}
