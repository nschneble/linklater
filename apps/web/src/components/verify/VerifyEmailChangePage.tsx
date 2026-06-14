import TokenVerificationPage from './TokenVerificationPage';
import { useAuth } from '../../auth/AuthContext';
import { verifyEmailChange } from '../../lib/api';

/**
 * Handles the `/verify-email-change?token=…` route.
 *
 * Calls `GET /auth/verify-email-change` with the token and delegates
 * rendering to `TokenVerificationPage`.
 *
 * This route is always accessible without authentication so that email
 * links work even when the user is logged out or using a different device.
 */
export default function VerifyEmailChangePage() {
  const { refreshUser } = useAuth();
  return (
    <TokenVerificationPage
      verifyingText="Confirming your new email…"
      signedInNotice="email-change-verified"
      signedOutNotice="email-change-verified-please-sign-in"
      invalidNotice="email-change-link-invalid"
      verifyFn={verifyEmailChange}
      onSuccess={refreshUser}
    />
  );
}
