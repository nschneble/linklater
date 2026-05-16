import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import AccountSettingsForm from './AccountSettingsForm';
import BookmarkletSection from './BookmarkletSection';
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
      <BookmarkletSection />
      <StumbleSection />
      <DangerZone />
    </div>
  );
}
