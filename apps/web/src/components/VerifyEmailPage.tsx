import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/api';
import { getErrorMessage } from '../lib/errors';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParameters.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token found in the link.');
      return;
    }

    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Verification failed.'));
      });
  }, [searchParameters]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--text)] text-2xl font-bold">
          Email Verification
        </h1>

        {status === 'verifying' && (
          <p className="text-[var(--text-muted)] animate-pulse">
            Verifying your email…
          </p>
        )}

        {status === 'success' && (
          <>
            <p className="mb-6 text-[var(--text-muted)]">
              <i
                className="fa-solid fa-circle-check mr-2 text-emerald-500"
                aria-hidden="true"
              />
              Your email has been verified. You&apos;re all set!
            </p>
            <button
              className="text-[var(--accent)] underline text-sm"
              onClick={() => navigate('/')}
            >
              Go to Linklater
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="mb-2 text-rose-400 text-sm" role="alert">
              {errorMessage}
            </p>
            <p className="mb-6 text-[var(--text-muted)] text-sm">
              The link may have expired. Request a new verification email from
              your account settings.
            </p>
            <button
              className="text-[var(--accent)] underline text-sm"
              onClick={() => navigate('/')}
            >
              Back to Linklater
            </button>
          </>
        )}
      </div>
    </div>
  );
}
