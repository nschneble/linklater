import { useState } from 'react';
import { ESCAPE_HATCH_DARK } from './escapeHatchStyles';

const SAVE_DESCRIPTION_ID = 'theme-editor-save-description';
const SAVE_NON_CUSTOM_HINT =
  'Saving is available for the custom theme only. Switch the theme selector to Custom to save.';

interface ThemeSaveBarProps {
  /** Whether the editor's selected theme is the editable custom theme. */
  isCustom: boolean;
  /** Whether a save round-trip is currently in flight. */
  isSaving: boolean;
  /** The live count of failing WCAG contrast pairs (single source: B5). */
  failingCount: number;
  /** Invoked when the user activates Save (only meaningful when custom). */
  onSave: () => void;
}

/**
 * The Save action for the Theme Editor.
 *
 * Save persists the current mode's tokens but only for the custom theme. For
 * the 10 built-in themes the button stays PRESENT and `aria-disabled` rather
 * than unmounting (a11y brief B6 – unmounting drops focus to body and churns
 * tab order). The button keeps a stable accessible name ("Save") across the
 * idle/saving states; the spinner glyph is `aria-hidden`. During a save both
 * `aria-disabled` and `aria-busy` are set on the SAME element (never native
 * `disabled`, never unmount) and the handler suppresses re-activation, so
 * focus never leaves the button (SC 4.1.2, SC 2.4.3, SC 4.1.3).
 *
 * When the user saves a custom theme that has failing contrast pairs we do
 * NOT block (a11y brief B5 – user autonomy; chrome paints from `:root` so a
 * recovery path always exists). Instead we surface the live failing count via
 * `aria-describedby` and announce it through a `role="alert"` at the discrete
 * save-attempt moment.
 */
export default function ThemeSaveBar({
  isCustom,
  isSaving,
  failingCount,
  onSave,
}: ThemeSaveBarProps) {
  const [saveAttemptMessage, setSaveAttemptMessage] = useState('');

  const isInactive = !isCustom || isSaving;

  function handleSave() {
    // Suppress activation when not custom or mid-flight (aria-disabled is not
    // enforced by the browser, so we guard in the handler – B1/B6).
    if (isInactive) return;
    if (failingCount > 0) {
      const pairWord = failingCount === 1 ? 'pair' : 'pairs';
      setSaveAttemptMessage(
        `Saving custom theme with ${failingCount} failing contrast ${pairWord}.`,
      );
    } else {
      setSaveAttemptMessage('Saving custom theme.');
    }
    onSave();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {isCustom && failingCount > 0 && (
        <p className="flex items-center gap-1 text-[var(--warn-highlight)] text-[0.65rem] font-medium">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          {failingCount} contrast {failingCount === 1 ? 'pair' : 'pairs'}{' '}
          failing
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        aria-disabled={isInactive}
        aria-busy={isSaving}
        aria-describedby={isCustom ? undefined : SAVE_DESCRIPTION_ID}
        style={ESCAPE_HATCH_DARK}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg active:scale-[0.96] aria-disabled:opacity-50 aria-disabled:active:scale-100 aria-disabled:cursor-not-allowed transition-transform cursor-pointer"
      >
        {isSaving && (
          <i
            className="fa-solid fa-circle-notch animate-spin text-[0.7rem]"
            aria-hidden="true"
          />
        )}
        {isSaving ? 'Saving…' : 'Save'}
      </button>

      {!isCustom && (
        <p id={SAVE_DESCRIPTION_ID} className="sr-only">
          {SAVE_NON_CUSTOM_HINT}
        </p>
      )}

      {/* role="alert" only at the discrete save-attempt moment (B5) – not a
          persistent live region, so it does not barrage on every edit. */}
      <p role="alert" className="sr-only">
        {saveAttemptMessage}
      </p>
    </div>
  );
}
