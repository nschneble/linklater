import Alert from '../common/Alert';
import { updateMe } from '../../lib/api';
import { useCallback, useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Settings section toggle for the OpenDyslexic interface font.
 *
 * Enabling it switches the app's UI font to OpenDyslexic and persists the
 * preference to the server via PATCH /users/me. The choice is independent of
 * the active color theme, so (unlike CVD mode) no `theme` field rides along
 * with the request.
 *
 * Uses `role="switch"` as required by ARIA for a binary toggle that has an
 * immediate effect (not a checkbox inside a form).
 */
export default function DyslexicFontToggle() {
  const { isDyslexicFont, enableDyslexicFont, disableDyslexicFont } =
    useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    setError(null);
    setLoading(true);

    if (isDyslexicFont) {
      disableDyslexicFont();
    } else {
      enableDyslexicFont();
    }

    try {
      await updateMe({ dyslexicFont: !isDyslexicFont });
    } catch (caughtError) {
      // reverts an optimistic local toggle on failure
      if (isDyslexicFont) {
        enableDyslexicFont();
      } else {
        disableDyslexicFont();
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong',
      );
    }

    setLoading(false);
  }, [isDyslexicFont, enableDyslexicFont, disableDyslexicFont]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label
            id="dyslexic-font-label"
            htmlFor="dyslexic-font-toggle"
            className="block text-[var(--mount-text)] text-sm font-medium cursor-pointer"
          >
            OpenDyslexic font
          </label>
          <p
            id="dyslexic-font-description"
            className="text-[var(--mount-alt-text)] text-xs text-pretty"
          >
            Switches the app's interface font to OpenDyslexic, a typeface
            designed for readers with dyslexia. It uses heavier strokes and
            distinct letter shapes (for example, asymmetric b/d/p/q) than the
            default font.
          </p>
        </div>

        <button
          type="button"
          id="dyslexic-font-toggle"
          role="switch"
          aria-checked={isDyslexicFont}
          aria-labelledby="dyslexic-font-label"
          aria-describedby="dyslexic-font-description"
          disabled={loading}
          onClick={handleToggle}
          className="group relative inline-flex shrink-0 items-center w-11 h-6 mt-0.5 bg-[var(--orbit-bg)] aria-checked:bg-[var(--orbit-highlight)] border border-[var(--orbit-border)] aria-checked:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-full transition-colors duration-200 cursor-pointer"
        >
          <span className="inline-block h-4 w-4 translate-x-1 group-aria-checked:translate-x-6 bg-white rounded-full shadow-sm transition-transform duration-200" />
          <span className="sr-only">{isDyslexicFont ? 'On' : 'Off'}</span>
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
