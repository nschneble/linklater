import EmailSettingsForm from './EmailSettingsForm';
import PasswordSettingsForm from './PasswordSettingsForm';

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
