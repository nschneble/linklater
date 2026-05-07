import { verifyEmail } from '../lib/api';
import TokenVerificationPage from './TokenVerificationPage';

/**
 * Handles the `/verify-email?token=...` route. Calls `GET /auth/verify-email`
 * with the token from the URL and delegates rendering to `TokenVerificationPage`.
 *
 * This route is always accessible without authentication so that email links
 * work even when the user is logged out.
 */
export default function VerifyEmailPage() {
  return (
    <TokenVerificationPage
      title="Email Verification"
      verifyingText="Verifying your email…"
      successText="Your email has been verified. You're all set!"
      helpText="The link may have expired. Request a new verification email from your account settings."
      verifyFn={verifyEmail}
    />
  );
}
