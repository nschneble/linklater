import EmailSettingsForm from './EmailSettingsForm';
import PasswordSettingsForm from './PasswordSettingsForm';

/**
 * Convenience wrapper that renders the two account-management subsections
 * (email + password) in order. The `SettingsGroup` that contains this
 * component owns the section heading and card chrome.
 */
export default function AccountSettingsForm() {
  return (
    <div className="space-y-8">
      <EmailSettingsForm />
      <PasswordSettingsForm />
    </div>
  );
}
