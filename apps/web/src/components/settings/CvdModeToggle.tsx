import Alert from '../common/Alert';
import SettingSwitch from './SettingSwitch';
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
      <SettingSwitch
        id="cvd"
        label="Color Vision Deficiency (CVD) mode"
        description={
          <>
            Switches to the{' '}
            <span className="font-semibold">Apollo 10½ theme</span> and adds
            distinctive visual non-color cues, including underlined links,
            striped disabled controls, stronger focus outlines, and selected
            indicator bars.
          </>
        }
        checked={isCvdMode}
        busy={loading}
        onToggle={handleToggle}
      />

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
