import ErrorBoundary from './components/errors/ErrorBoundary';
import { commonRoutes } from './routes/Common';
import { unauthenticatedRoutes } from './routes/Unauthenticated';
import { userRoutes } from './routes/User';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { useTheme, type BaseTheme, type Mode } from './theme/ThemeContext';
import {
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  RECENT_LOCAL_CHANGE_MS,
  readLocalStorage,
} from './theme/storage';
import { Routes } from 'react-router-dom';

export default function App() {
  const { user, loading } = useAuth();
  const {
    applyServerTheme,
    applyServerMode,
    enableCvdMode,
    disableCvdMode,
    isCvdMode,
  } = useTheme();

  // Syncs server-side theme and mode preferences into ThemeContext after
  // login. Without this, a user who changed their theme on one device
  // would see the old theme on another device until they changed it.
  // applyServerTheme/applyServerMode skip the update if the user made a
  // local change w/in the last 30s (optimistic race-condition guard).

  // Skip applyServerTheme entirely when CVD mode is active (server/local).
  // The CVD sync effect is the source of truth for which theme is active.
  // applyServerTheme would otherwise stomp the Apollo 10½ theme on a
  // cold-load device.

  useEffect(() => {
    if (!user) return;
    const localCvdOn = readLocalStorage(CVD_MODE_KEY) === 'on';
    if (!user.cvdMode && !isCvdMode && !localCvdOn) {
      applyServerTheme(user.theme as BaseTheme);
    }
    if (user.mode === 'light' || user.mode === 'dark')
      applyServerMode(user.mode as Mode);
  }, [user, applyServerTheme, applyServerMode, isCvdMode]);

  // Syncs CVD mode from the server with a 30s local-change guard. If the
  // user toggled CVD mode within the last 30s, skip the server sync to
  // avoid overwriting an optimistic update.

  useEffect(() => {
    if (!user) return;

    const updatedAt = parseInt(readLocalStorage(CVD_UPDATED_AT_KEY) ?? '0', 10);
    if (Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS) return;

    if (user.cvdMode && !isCvdMode) {
      enableCvdMode();
    } else if (!user.cvdMode && isCvdMode) {
      // Only disable if the local state disagrees AND there was no recent local write
      const localState = readLocalStorage(CVD_MODE_KEY);
      if (localState !== 'on') {
        disableCvdMode();
      }
    }
  }, [user, isCvdMode, enableCvdMode, disableCvdMode]);

  if (loading) {
    return (
      <div
        role="status"
        className="flex items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text)] select-none"
      >
        <div className="text-slate-400 text-sm animate-pulse">
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
