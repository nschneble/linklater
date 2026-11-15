import { getErrorMessage } from '../../lib/errors';
import { resetPassword } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useNavigate, useSearchParams } from 'react-router';
import { useState, type FormEvent } from 'react';

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);

    const token = searchParameters.get('token');
    if (!token) {
      setError('No reset token found in the link.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
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
      setError(getErrorMessage(caughtError, 'Password reset failed.'));
      setLoading(false);
    }
  };

  return {
    confirm,
    error,
    handleSubmit,
    loading,
    password,
    pendingMfa,
    setConfirm,
    setPassword,
  };
}
