import {
  setShortcutsEnabled,
  useShortcutsEnabled,
} from '../../lib/hooks/useShortcutsEnabled';
import { useCallback } from 'react';

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

  const handleToggle = useCallback(() => {
    setShortcutsEnabled(!shortcutsEnabled);
  }, [shortcutsEnabled]);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <label
          id="shortcuts-label"
          htmlFor="shortcuts-toggle"
          className="block text-[var(--mount-text)] text-sm font-medium cursor-pointer"
        >
          Keyboard shortcuts
        </label>
        <p
          id="shortcuts-description"
          className="text-[var(--mount-alt-text)] text-xs text-pretty"
        >
          Single-key shortcuts like <span className="font-semibold">D</span> to
          stumble or <span className="font-semibold">A</span> to add a link let
          you move without the mouse. Switch them off if stray keystrokes set
          them off on their own, which can happen with speech-to-text tools.
        </p>
      </div>

      <button
        type="button"
        id="shortcuts-toggle"
        role="switch"
        aria-checked={shortcutsEnabled}
        aria-labelledby="shortcuts-label"
        aria-describedby="shortcuts-description"
        onClick={handleToggle}
        className="group relative inline-flex shrink-0 items-center w-11 h-6 mt-0.5 bg-[var(--orbit-bg)] aria-checked:bg-[var(--orbit-highlight)] border border-[var(--orbit-border)] aria-checked:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-full transition-colors duration-200 cursor-pointer"
      >
        <span className="inline-block h-4 w-4 translate-x-1 group-aria-checked:translate-x-6 bg-white rounded-full shadow-sm transition-transform duration-200" />
        <span className="sr-only">{shortcutsEnabled ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
