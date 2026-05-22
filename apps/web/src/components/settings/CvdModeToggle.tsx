import Alert from '../common/Alert';
import { updateMe } from '../../lib/api';
import { useCallback, useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Settings section toggle for CVD mode.
 *
 * Enabling CVD mode switches to the Apollo 10½ theme, enables
 * shape/icon enhancements for color-independent meaning, and persists the
 * preference to the server via PATCH /users/me.
 *
 * Uses `role="switch"` as required by ARIA for a binary toggle that has an
 * immediate effect (not a checkbox inside a form).
 */
export default function CvdModeToggle() {
  const { isCvdMode, enableCvdMode, disableCvdMode } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    setError(null);
    setLoading(true);

    const theme = isCvdMode ? disableCvdMode() : enableCvdMode();
    try {
      await updateMe({ cvdMode: !isCvdMode, theme: theme });
    } catch (caughtError) {
      // reverts an optimistic local toggle on failure
      if (isCvdMode) {
        enableCvdMode();
      } else {
        disableCvdMode();
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong',
      );
    }

    setLoading(false);
  }, [isCvdMode, enableCvdMode, disableCvdMode]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label
            id="cvd-label"
            htmlFor="cvd-toggle"
            className="block text-[var(--text)] text-sm font-medium cursor-pointer"
          >
            Color Vision Deficiency (CVD) mode
          </label>
          <p id="cvd-description" className="text-[var(--text-muted)] text-xs">
            Switches to the Apollo 10½ theme, adds icons next to colored badges,
            and increases overall contrast.
          </p>
        </div>

        <button
          type="button"
          id="cvd-toggle"
          role="switch"
          aria-checked={isCvdMode}
          aria-labelledby="cvd-label"
          aria-describedby="cvd-description"
          disabled={loading}
          onClick={handleToggle}
          className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] cursor-pointer ${
            isCvdMode
              ? 'bg-[var(--accent)]'
              : 'bg-[var(--bg-elevated)] border border-[var(--border)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isCvdMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          <span className="sr-only">{isCvdMode ? 'On' : 'Off'}</span>
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
