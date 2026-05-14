import AccountSettingsForm from './AccountSettingsForm';
import BookmarkletSection from './BookmarkletSection';
import DangerZone from './DangerZone';
import StumbleSection from '../stumble/StumbleSection';
import TwoFactorSection from './TwoFactorSection';

/**
 * The `/settings` page. A simple vertical stack of the three settings
 * sections: account settings (email + password), bookmarklet installation,
 * and the danger zone (account deletion). All state is managed within each
 * section's own component.
 */
export default function SettingsView() {
  return (
    <div className="space-y-8">
      <AccountSettingsForm />
      <TwoFactorSection />
      <BookmarkletSection />
      <StumbleSection />
      <DangerZone />
    </div>
  );
}
