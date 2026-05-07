import AccountSettingsForm from './AccountSettingsForm';
import BookmarkletSection from './BookmarkletSection';
import DangerZone from './DangerZone';

/**
 * The `/settings` page. A simple vertical stack of the three settings sections:
 * account settings (email + password), bookmarklet installation, and the
 * danger zone (account deletion). All state is managed within each section's
 * own component.
 */
export default function SettingsView() {
  return (
    <div className="space-y-6">
      <AccountSettingsForm />
      <BookmarkletSection />
      <DangerZone />
    </div>
  );
}
