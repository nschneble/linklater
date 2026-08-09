import { commonRoutes } from './routes/Common';
import {
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  DYSLEXIC_FONT_KEY,
  DYSLEXIC_FONT_UPDATED_AT_KEY,
  readLocalStorage,
} from './theme/storage';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { Routes } from 'react-router';
import { unauthenticatedRoutes } from './routes/Unauthenticated';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { userRoutes } from './routes/User';
import { useServerBooleanPrefSync } from './theme/useServerBooleanPrefSync';
import { useTheme } from './theme/ThemeContext';

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

  if (loading) {
    return (
      <div
        role="status"
        className="flex items-center justify-center min-h-svh bg-[var(--base-bg)] text-[var(--base-text)] select-none"
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
