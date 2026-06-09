import { setPassword as apiSetPassword } from '../../../lib/api';
import { capitalizeFirst } from '../../../lib/strings';
import { getErrorMessage } from '../../../lib/errors';
import Alert from '../../common/Alert';
import FormInput from '../../common/FormInput';
import PrimaryButton from '../../common/PrimaryButton';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AddPasswordFormProps } from './types';

/**
 * Add-password form for passwordless accounts (created via SSO or magic
 * link) adding a backup credential. Submits to `POST /auth/set-password`.
 */
export default function AddPasswordForm({ refreshUser }: AddPasswordFormProps) {
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
        capitalizeFirst(getErrorMessage(caughtError, 'Failed to set password')),
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
      <h3
        id="add-password-heading"
        className="mb-0 text-[var(--mount-text)] text-sm font-semibold text-balance"
      >
        Password
      </h3>
      <div className="flex items-center gap-2">
        <span className="my-0.75 text-[var(--mount-alt-text)] text-xs">
          No password has been set
        </span>
      </div>

      <label
        className="block mb-0 text-[var(--mount-alt-text)] text-xs font-medium"
        htmlFor="add-password-input"
      >
        Password
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
        {addPasswordSaving ? 'Adding…' : 'Add password'}
      </PrimaryButton>
    </form>
  );
}
