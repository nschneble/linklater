import TokenVerificationPage from './TokenVerificationPage';
import { useAuth } from '../../auth/AuthContext';
import { verifyEmail } from '../../lib/api';

/**
 * Handles the `/verify-email?token=…` route.
 *
 * Calls `GET /auth/verify-email` with the token from the URL and delegates
 * rendering to `TokenVerificationPage`.
 *
 * This route is always accessible without authentication so that email
 * links work even when the user is logged out or using a different device.
 */
export default function VerifyEmailPage() {
  const { refreshUser } = useAuth();
  return (
    <TokenVerificationPage
      title="Email Verification"
      verifyingText="Verifying your email…"
      signedInNotice="email-verified"
      signedOutNotice="email-verified-please-sign-in"
      helpText="The link may have expired. Request a new verification email from the Settings page."
      verifyFn={verifyEmail}
      onSuccess={refreshUser}
    />
  );
}
