import ErrorBoundary from './components/errors/ErrorBoundary';
import { commonRoutes } from './routes/Common';
import { unauthenticatedRoutes } from './routes/Unauthenticated';
import { userRoutes } from './routes/User';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { useTheme, type BaseTheme, type Mode } from './theme/ThemeContext';
import { Routes } from 'react-router-dom';

export default function App() {
  const { user, loading } = useAuth();
  const { applyServerTheme, applyServerMode } = useTheme();

  // Syncs server-side theme and mode preferences into ThemeContext after
  // login. Without this, a user who changed their theme on one device
  // would see the old theme on another device until they changed it.
  // applyServerTheme/applyServerMode skip the update if the user made a
  // local change w/in the last 30s (optimistic race-condition guard).
  useEffect(() => {
    if (!user) return;
    applyServerTheme(user.theme as BaseTheme);
    if (user.mode === 'light' || user.mode === 'dark')
      applyServerMode(user.mode as Mode);
  }, [user, applyServerTheme, applyServerMode]);

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
