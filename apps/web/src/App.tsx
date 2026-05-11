import AppShell from './AppShell';
import AuthForm from './components/AuthForm';
import ErrorBoundary from './components/ErrorBoundary';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import OAuthCallbackPage from './components/OAuthCallbackPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import VerifyEmailChangePage from './components/VerifyEmailChangePage';
import VerifyEmailPage from './components/VerifyEmailPage';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { useTheme, type BaseTheme, type Mode } from './theme/ThemeContext';

/**
 * Root app component. Handles top-level routing and authentication.
 *
 * Route structure:
 * - `/verify-email` and `/verify-email-change` are always accessible so
 *   that email links work even when the user is logged out.
 * - `/reset-password` is similarly public.
 * - Unauthenticated users are redirected to `/login` for all other routes.
 *   The originally-requested path is stored in route state so `AuthForm`
 *   can bounce the user back after a successful login.
 * - Authenticated users are redirected from `/` and `/login` to `/unread`.
 *
 * NOTE: The `useEffect` that syncs server preferences into `ThemeContext`
 * runs whenever `user` changes (i.e. on login). This ensures the theme and
 * mode stored in the database override the `localStorage` defaults the
 * user may have set in a different browser session.
 */
function UnauthenticatedRedirect() {
  const location = useLocation();
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

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
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/verify-email-change"
          element={<VerifyEmailChangePage />}
        />

        {user ? (
          <>
            <Route path="/login" element={<Navigate to="/unread" replace />} />
            <Route path="/signup" element={<Navigate to="/unread" replace />} />
            <Route
              path="/forgot-password"
              element={<Navigate to="/unread" replace />}
            />
            <Route path="/" element={<Navigate to="/unread" replace />} />
            <Route path="/*" element={<AppShell />} />
          </>
        ) : (
          <>
            {['/login', '/signup', '/forgot-password'].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
                    <AuthForm />
                  </div>
                }
              />
            ))}
            <Route path="*" element={<UnauthenticatedRedirect />} />
          </>
        )}
      </Routes>
    </ErrorBoundary>
  );
}
