import Alert from '../common/Alert';
import LinkButton from '../common/LinkButton';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../lib/errors';

/** The three states of a token verification flow. */
type Status = 'verifying' | 'success' | 'error';

/**
 * Props that configure the page copy for each specific verification flow.
 * The logic is identical for email verification and email-change verification —
 * only the user-visible text differs.
 */
interface TokenVerificationPageProps {
  /** Page heading (e.g. "Email Verification", "Email Change"). */
  title: string;
  /** Text shown while the API call is in flight. */
  verifyingText: string;
  /** Text shown after a successful verification. */
  successText: string;
  /** Text shown below the error message to guide the user. */
  helpText: string;
  /**
   * The verification API function to call. Receives the token from the
   * `?token=` query parameter. Should resolve on success and reject with
   * an error on failure.
   */
  verifyFn: (token: string) => Promise<void>;
  /**
   * Called immediately after a successful verification, before the user
   * navigates away. Use to refresh stale auth state (e.g. re-fetch the
   * user profile so email changes/verifications are reflected on return).
   */
  onSuccess?: () => void | Promise<void>;
}

/**
 * Generic full-page token verification UI. Reads `?token=` from the URL,
 * calls `verifyFn`, and renders one of three states: verifying, success, or
 * error. On success or error, a "Go to Linklater" / "Back to Linklater" button
 * navigates to `/`.
 *
 * Used by `VerifyEmailPage` (for initial email verification) and
 * `VerifyEmailChangePage` (for email-change confirmation).
 */
export default function TokenVerificationPage({
  title,
  verifyingText,
  successText,
  helpText,
  verifyFn,
  onSuccess,
}: TokenVerificationPageProps) {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token found in the link.');
      return;
    }

    verifyFn(token)
      .then(() => {
        setStatus('success');
        onSuccess?.();
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Verification failed.'));
      });
  }, [onSuccess, searchParameters, verifyFn]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
          {title}
        </h1>

        {status === 'verifying' && (
          <p
            role="status"
            aria-live="polite"
            className="text-[var(--mount-alt-text)] animate-pulse"
          >
            {verifyingText}
          </p>
        )}

        {status === 'success' && (
          <>
            <p className="mb-6 text-[var(--mount-alt-text)]">
              <i
                className="fa-solid fa-circle-check mr-2 text-[var(--success-highlight)]"
                aria-hidden="true"
              />
              {successText}
            </p>
            <LinkButton
              surface="mount"
              className="text-sm"
              onClick={() => navigate('/unread')}
            >
              Go to Linklater
            </LinkButton>
          </>
        )}

        {status === 'error' && (
          <>
            <Alert
              className="mb-2"
              icon="fa-triangle-exclamation"
              variant="error"
            >
              {errorMessage}
            </Alert>
            <p className="mb-6 text-[var(--mount-alt-text)] text-sm">
              {helpText}
            </p>
            <LinkButton
              surface="mount"
              className="text-sm"
              onClick={() => navigate('/unread')}
            >
              Back to Linklater
            </LinkButton>
          </>
        )}
      </div>
    </div>
  );
}
