import { useAuth } from '../../auth/AuthContext';
import { setPassword as apiSetPassword, updateMe } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import PrimaryButton from '../common/PrimaryButton';
import { useState } from 'react';
import type { FormEvent } from 'react';

/**
 * Password management form. Two flavors based on whether the user already
 * has a password set:
 *
 * - Has password → change-password flow: submits to `PATCH /users/me` with
 *   both `currentPassword` and `password`.
 * - No password → add-password flow (SSO-only accounts adding a backup
 *   credential): submits to `POST /auth/set-password`.
 *
 * Error state stays inside this component so the inserted `role="alert"`
 * announces reliably to screen readers.
 */
export default function PasswordSettingsForm() {
  const { refreshUser, user } = useAuth();
  const hasPassword = Boolean(user?.hasPassword);

  if (hasPassword) {
    return <ChangePasswordForm />;
  }
  return <AddPasswordForm refreshUser={refreshUser} />;
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setPasswordMessage('Nothing to update');
      return;
    }

    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSaving(true);

    try {
      await updateMe({ password, currentPassword });
      setCurrentPassword('');
      setPassword('');
      setPasswordMessage('Password updated');
    } catch (caughtError: unknown) {
      setPasswordError(
        getErrorMessage(caughtError, 'Failed to update password'),
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      aria-labelledby="password-settings-heading"
      onSubmit={handleSubmit}
    >
      <h2
        id="password-settings-heading"
        className="text-[var(--text)] text-sm font-semibold text-balance"
      >
        Password
      </h2>

      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="new-password"
      >
        New password
      </label>
      <FormInput
        id="new-password"
        type="password"
        placeholder="Leave blank to keep current password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby={passwordError ? 'account-password-error' : undefined}
      />

      {password && (
        <>
          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="current-password"
          >
            Current password
          </label>
          <FormInput
            id="current-password"
            type="password"
            placeholder="Required to confirm password change"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </>
      )}

      {passwordMessage && <Alert variant="success">{passwordMessage}</Alert>}
      {passwordError && (
        <Alert id="account-password-error" variant="error">
          {passwordError}
        </Alert>
      )}

      <PrimaryButton disabled={passwordSaving || !password} className="py-2.5">
        <i
          className="fa-solid fa-floppy-disk text-[0.7rem]"
          aria-hidden="true"
        />
        {passwordSaving ? 'Saving…' : 'Update password'}
      </PrimaryButton>
    </form>
  );
}

interface AddPasswordFormProps {
  refreshUser: () => Promise<void>;
}

function AddPasswordForm({ refreshUser }: AddPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [addPasswordError, setAddPasswordError] = useState<string | null>(null);
  const [addPasswordSaving, setAddPasswordSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setAddPasswordError(null);
    setAddPasswordSaving(true);

    try {
      await apiSetPassword(newPassword);
      setNewPassword('');
      await refreshUser();
    } catch (caughtError: unknown) {
      setAddPasswordError(
        getErrorMessage(caughtError, 'Failed to set password'),
      );
    } finally {
      setAddPasswordSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      aria-labelledby="add-password-heading"
      onSubmit={handleSubmit}
    >
      <h2
        id="add-password-heading"
        className="text-[var(--text)] text-sm font-semibold text-balance"
      >
        Password
      </h2>
      <p className="text-[var(--text-muted)] text-xs">
        Add a password for backup access alongside social sign-in.
      </p>

      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="add-password-input"
      >
        New password
      </label>
      <FormInput
        id="add-password-input"
        type="password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        aria-describedby={
          addPasswordError ? 'account-add-password-error' : undefined
        }
      />

      {addPasswordError && (
        <Alert id="account-add-password-error" variant="error">
          {addPasswordError}
        </Alert>
      )}

      <PrimaryButton
        disabled={addPasswordSaving || !newPassword}
        className="py-2.5"
      >
        <i className="fa-solid fa-key text-[0.7rem]" aria-hidden="true" />
        {addPasswordSaving ? 'Saving…' : 'Add password'}
      </PrimaryButton>
    </form>
  );
}
