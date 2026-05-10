import TokenVerificationPage from './TokenVerificationPage';
import { verifyEmailChange } from '../lib/api';

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
  return (
    <TokenVerificationPage
      title="Email Change"
      verifyingText="Confirming your new email…"
      successText="Your email has been updated. You're good to go!"
      helpText="The link may have expired. Request a new email change from the Settings page."
      verifyFn={verifyEmailChange}
    />
  );
}
