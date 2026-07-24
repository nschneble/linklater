import LinkButton from '../common/LinkButton';
import {
  setShortcutsEnabled,
  useShortcutsEnabled,
} from '../../lib/hooks/useShortcutsEnabled';
import SettingSwitch from './SettingSwitch';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * Settings toggle for the app's single-key keyboard shortcuts (WCAG 2.1.4,
 * Character Key Shortcuts). Turning it off stops keys like `d` (Stumble) and
 * `x` (menu) from acting, which protects speech-input users whose dictation
 * can land as stray keystrokes.
 *
 * The preference is device-local (`localStorage`) and shared with the two
 * shortcut listeners via `useShortcutsEnabled`, so the switch and the
 * listeners stay in sync from one source of truth.
 *
 * Uses `role="switch"` with `aria-checked` for a binary toggle that takes
 * immediate effect; the flip self-announces as "switch, on/off", so no live
 * region or toast is needed (that would double-announce).
 */
export default function KeyboardShortcutsToggle() {
  const shortcutsEnabled = useShortcutsEnabled();
  const navigate = useNavigate();

  const handleToggle = useCallback(() => {
    setShortcutsEnabled(!shortcutsEnabled);
  }, [shortcutsEnabled]);

  return (
    <SettingSwitch
      id="shortcuts"
      label="Keyboard shortcuts"
      description={
        <>
          Provides quick keyboard navigation for many actions on the{' '}
          <LinkButton
            className="inline-flex"
            surface="mount"
            onClick={() => navigate('/unread')}
          >
            Your Links
          </LinkButton>{' '}
          page, such as <span className="font-semibold">Q</span> to search and{' '}
          <span className="font-semibold">A</span> to add links.
        </>
      }
      checked={shortcutsEnabled}
      onToggle={handleToggle}
    />
  );
}
