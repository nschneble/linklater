import Alert from '../common/Alert';
import SettingSwitch from './SettingSwitch';
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
      <SettingSwitch
        id="dyslexic-font"
        label="OpenDyslexic font"
        description="Switches the app's interface font to OpenDyslexic, a typeface designed for readers with dyslexia. It uses heavier strokes and more distinctive letter shapes than the default font (for example, asymmetric b/d/p/q)."
        checked={isDyslexicFont}
        disabled={loading}
        onToggle={handleToggle}
      />

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
