import { getErrorMessage } from '../../../lib/errors';
import Alert from '../../common/Alert';
import FormInput from '../../common/FormInput';
import PrimaryButton from '../../common/PrimaryButton';
import { updateMe } from '../../../lib/api';
import { useState } from 'react';
import type { FormEvent } from 'react';

/**
 * Change-password form for accounts that already have a password set.
 * Submits to `PATCH /users/me` with both `currentPassword` and `password`.
 */
export default function ChangePasswordForm() {
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
      className="space-y-4 mb-8"
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
        autoComplete="new-password"
        placeholder="Leave blank to keep current password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby={passwordError ? 'account-password-error' : undefined}
      />

      {/*
        CSS-hidden (not unmounted) so that focus never drops unexpectedly when
        the user clears the new-password field, and so password managers can
        always read both fields together.
      */}
      <div hidden={!password}>
        <label
          className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
          htmlFor="current-password"
        >
          Current password
        </label>
        <FormInput
          id="current-password"
          type="password"
          autoComplete="current-password"
          placeholder="Required to confirm password change"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required={Boolean(password)}
        />
      </div>

      {passwordMessage && <Alert variant="success">{passwordMessage}</Alert>}
      {passwordError && (
        <Alert id="account-password-error" variant="error">
          {passwordError}
        </Alert>
      )}

      <PrimaryButton disabled={passwordSaving || !password} className="py-2.5">
        <i className="fa-solid fa-key text-[0.7rem]" aria-hidden="true" />
        {passwordSaving ? 'Saving…' : 'Save new password'}
      </PrimaryButton>
    </form>
  );
}
