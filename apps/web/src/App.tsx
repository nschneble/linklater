import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { useEffect } from 'react';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import AppShell from './AppShell';
import AuthForm from './components/AuthForm';
import ResetPasswordPage from './components/ResetPasswordPage';
import VerifyEmailPage from './components/VerifyEmailPage';

export default function App() {
  const { user, loading } = useAuth();
  const { setBaseTheme, setMode } = useTheme();

  // syncs server-side preferences into ThemeContext when the user logs in
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
    <Routes>
      <Route path="/verify-email" element={<VerifyEmailPage />} />
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
  );
}
