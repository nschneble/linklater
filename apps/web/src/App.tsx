import BootInterstitial from './components/common/BootInterstitial';
import { commonRoutes } from './routes/Common';
import {
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  DYSLEXIC_FONT_KEY,
  DYSLEXIC_FONT_UPDATED_AT_KEY,
  readLocalStorage,
} from './theme/storage';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { resolveBootLanding } from './lib/hooks/useBootStatus.landing';
import { Routes } from 'react-router';
import { unauthenticatedRoutes } from './routes/Unauthenticated';
import { useAuth } from './auth/AuthContext';
import { useBootStatus } from './lib/hooks/useBootStatus';
import { useEffect, useState } from 'react';
import { userRoutes } from './routes/User';
import { useServerBooleanPrefSync } from './theme/useServerBooleanPrefSync';
import { useTheme } from './theme/ThemeContext';

interface AppRoutesProps {
  signedIn: boolean;
}

/**
 * The route table, built inside a render of its own.
 *
 * The three builders are ordinary function calls, so wherever they are
 * written is where they run. Written inline under `<ErrorBoundary>` they
 * would still run during `App`'s render, which is above the boundary and
 * therefore outside anything it can catch: a throw while the table is
 * being assembled would take the whole document down with no fallback.
 * A component moves the calls into a render the boundary does cover.
 */
function AppRoutes({ signedIn }: AppRoutesProps) {
  return (
    <Routes>
      {commonRoutes()}
      {signedIn ? userRoutes() : unauthenticatedRoutes()}
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  // one-way: this boundary has no resetKey, so a caught crash is the end
  const [crashed, setCrashed] = useState(false);
  const boot = useBootStatus(
    loading,
    resolveBootLanding(crashed, Boolean(user)),
  );
  const {
    applyServerTheme,
    applyServerMode,
    applyServerCustomTheme,
    applyServerCustomThemeEnabled,
    enableCvdMode,
    disableCvdMode,
    isCvdMode,
    enableDyslexicFont,
    disableDyslexicFont,
    isDyslexicFont,
  } = useTheme();

  // skip applyServerTheme while CVD is active so it can't stomp Apollo 10½
  useEffect(() => {
    if (!user) return;
    const localCvdOn = readLocalStorage(CVD_MODE_KEY) === 'on';
    if (!user.cvdMode && !isCvdMode && !localCvdOn) {
      applyServerTheme(user.theme);
    }
    applyServerMode(user.mode);
    applyServerCustomTheme(user.customTheme);
    applyServerCustomThemeEnabled(user.customThemeEnabled);
  }, [
    user,
    applyServerTheme,
    applyServerMode,
    applyServerCustomTheme,
    applyServerCustomThemeEnabled,
    isCvdMode,
  ]);

  // sync CVD + dyslexic font from server with a 30s local-change guard
  useServerBooleanPrefSync(
    user?.cvdMode,
    isCvdMode,
    enableCvdMode,
    disableCvdMode,
    { updatedAtKey: CVD_UPDATED_AT_KEY, valueKey: CVD_MODE_KEY },
  );
  useServerBooleanPrefSync(
    user?.dyslexicFont,
    isDyslexicFont,
    enableDyslexicFont,
    disableDyslexicFont,
    { updatedAtKey: DYSLEXIC_FONT_UPDATED_AT_KEY, valueKey: DYSLEXIC_FONT_KEY },
  );

  // hoisted above the branch so the region is never remounted
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {boot.announcement}
      </p>
      {boot.phase === 'interstitial' && <BootInterstitial />}
      {boot.phase === 'app' && (
        <ErrorBoundary onError={() => setCrashed(true)}>
          <AppRoutes signedIn={Boolean(user)} />
        </ErrorBoundary>
      )}
    </>
  );
}
