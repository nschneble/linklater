import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import AppShell from './AppShell';
import AuthForm from './components/AuthForm';
import ErrorBoundary from './components/ErrorBoundary';
import ResetPasswordPage from './components/ResetPasswordPage';
import VerifyEmailChangePage from './components/VerifyEmailChangePage';
import VerifyEmailPage from './components/VerifyEmailPage';

/**
 * Root application component. Handles top-level routing and auth-gating.
 *
 * Route structure:
 * - `/verify-email` and `/verify-email-change` are always accessible (no auth
 *   required) so that email links work even when the user is logged out.
 * - `/reset-password` is similarly public.
 * - Unauthenticated users are redirected to the login form for all other routes.
 * - Authenticated users are redirected from `/` to `/unread` and then rendered
 *   inside `AppShell`.
 *
 * NOTE: The `useEffect` that syncs server preferences into `ThemeContext` runs
 * whenever `user` changes (i.e. on login). This ensures that the theme and
 * mode stored in the database override the `localStorage` defaults the user
 * may have set in a different browser session.
 */
export default function App() {
  const { user, loading } = useAuth();
  const { setBaseTheme, setMode } = useTheme();

  // Sync server-side theme and mode preferences into ThemeContext after login
  // or initial auth-check. Without this, a user who changed their theme on
  // one device would see the old theme on another device until they changed it.
  useEffect(() => {
    if (!user) return;
    setBaseTheme(user.theme as BaseTheme);
    if (user.mode === 'light' || user.mode === 'dark') setMode(user.mode);
  }, [user, setBaseTheme, setMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text)] select-none">
        <div className="text-slate-400 text-sm animate-pulse">
          Defrosting Linklater in the microwave…
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes — accessible without authentication */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/verify-email-change"
          element={<VerifyEmailChangePage />}
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {!user ? (
          <Route
            path="*"
            element={
              <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
                <AuthForm />
              </div>
            }
          />
        ) : (
          <>
            <Route path="/" element={<Navigate to="/unread" replace />} />
            <Route path="/*" element={<AppShell />} />
          </>
        )}
      </Routes>
    </ErrorBoundary>
  );
}
