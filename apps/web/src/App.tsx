import ErrorBoundary from './components/errors/ErrorBoundary';
import { commonRoutes } from './routes/Common';
import { unauthenticatedRoutes } from './routes/Unauthenticated';
import { userRoutes } from './routes/User';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { useServerBooleanPrefSync } from './theme/useServerBooleanPrefSync';
import { useTheme } from './theme/ThemeContext';
import {
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  DYSLEXIC_FONT_KEY,
  DYSLEXIC_FONT_UPDATED_AT_KEY,
  readLocalStorage,
} from './theme/storage';
import { Routes } from 'react-router';

export default function App() {
  const { user, loading } = useAuth();
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

  // Syncs server-side theme and mode preferences into ThemeContext after
  // login, so a theme change on one device shows up on another. The
  // applyServer* helpers skip the update when the user made a local change in
  // the last 30s (optimistic race guard). applyServerTheme is skipped entirely
  // while CVD mode is active (server or local): the CVD sync below owns the
  // active theme and would otherwise stomp Apollo 10½ on a cold-load device.
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

  // Syncs CVD mode and the dyslexic font from the server, each with a 30s
  // local-change guard that skips the sync right after an optimistic toggle.
  // CVD mode also swaps the active color theme; the dyslexic font is
  // theme-independent, so it has no applyServerTheme interaction to guard.
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

  if (loading) {
    return (
      <div
        role="status"
        className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-text)] select-none"
      >
        <div className="text-[var(--base-alt-text)] text-sm animate-pulse">
          Defrosting Linklater in the microwave…
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        {commonRoutes()}
        {user ? userRoutes() : unauthenticatedRoutes()}
      </Routes>
    </ErrorBoundary>
  );
}
