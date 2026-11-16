import { getErrorMessage } from '../../lib/errors';
import { resetPassword } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

interface PendingMfa {
  mfaMethod: 'totp';
  mfaToken: string;
}

export function useResetPasswordForm() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedSubmitCount, setFailedSubmitCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);
  const errorReference = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (failedSubmitCount > 0) errorReference.current?.focus();
  }, [failedSubmitCount]);

  const failSubmit = (message: string) => {
    setError(message);
    setFailedSubmitCount((count) => count + 1);
  };

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setConfirmMismatch(false);

    const token = searchParameters.get('token');
    if (!token) {
      failSubmit('No reset token found in the link.');
      return;
    }

    if (password !== confirm) {
      setConfirmMismatch(true);
      failSubmit('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);
      if ('mfaToken' in result) {
        setPendingMfa(result);
        setLoading(false);
        return;
      }
      // server issued the session; hydrate auth and route to the app
      await refreshUser();
      setPendingNotice('password-reset-success');
      navigate('/unread', { replace: true });
    } catch (caughtError: unknown) {
      failSubmit(getErrorMessage(caughtError, 'Password reset failed.'));
      setLoading(false);
    }
  };

  return {
    confirm,
    confirmMismatch,
    error,
    errorReference,
    failedSubmitCount,
    handleSubmit,
    loading,
    password,
    pendingMfa,
    setConfirm,
    setPassword,
  };
}
