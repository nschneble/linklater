import EmailSettingsForm from './EmailSettingsForm';
import PasswordSettingsForm from './PasswordSettingsForm';

/**
 * Account settings section: composes the email-change form and the
 * password-change/add-password form into a single panel. The two children
 * own their respective state and error lifecycles so that `role="alert"`
 * announcements fire reliably and the components can be tested in
 * isolation.
 */
export default function AccountSettingsForm() {
  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-[var(--text)] text-xl font-semibold text-balance">
        Account settings
      </h1>
      <EmailSettingsForm />
      <PasswordSettingsForm />
    </div>
  );
}
