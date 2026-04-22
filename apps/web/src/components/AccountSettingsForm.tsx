import { updateMe } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useState, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import PrimaryButton from './ui/PrimaryButton';

export default function AccountSettingsForm() {
  const { updateEmail, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload: {
        email?: string;
        currentPassword?: string;
        password?: string;
      } = {};

      if (email && email !== user?.email) payload.email = email;

      if (password) {
        payload.password = password;
        payload.currentPassword = currentPassword;
      }

      if (!payload.email && !payload.password) {
        setMessage('Nothing to update');
      } else {
        await updateMe(payload);
        if (payload.email) updateEmail(payload.email);
        setMessage('Settings updated');
      }

      setCurrentPassword('');
      setPassword('');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="max-w-md space-y-4" onSubmit={handleSave}>
      <h2 className="text-[var(--text)] text-xl font-semibold">
        Account settings
      </h2>

      <label className="block text-[var(--text-muted)] text-xs font-medium">
        Email
        <FormInput
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="block text-[var(--text-muted)] text-xs font-medium">
        New password
        <FormInput
          type="password"
          placeholder="Leave blank to keep current password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {password && (
        <label className="block text-[var(--text-muted)] text-xs font-medium">
          Current password
          <FormInput
            type="password"
            placeholder="Required to confirm password change"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
      )}

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <PrimaryButton disabled={saving} className="py-2.5">
        {saving ? 'Saving…' : 'Save changes'}
      </PrimaryButton>
    </form>
  );
}
