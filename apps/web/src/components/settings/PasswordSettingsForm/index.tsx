import AddPasswordForm from './AddPasswordForm';
import ChangePasswordForm from './ChangePasswordForm';
import { useAuth } from '../../../auth/AuthContext';

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
