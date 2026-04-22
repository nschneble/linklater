import AccountSettingsForm from './AccountSettingsForm';
import BookmarkletSection from './BookmarkletSection';
import DangerZone from './DangerZone';

export default function SettingsView() {
  return (
    <div className="space-y-6">
      <AccountSettingsForm />
      <BookmarkletSection />
      <DangerZone />
    </div>
  );
}
