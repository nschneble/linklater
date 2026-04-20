import { useEffect } from 'react';
import AuthForm from './components/AuthForm';
import AppShell from './AppShell';
import { useAuth } from './auth/AuthContext';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

export default function App() {
  const { user, loading } = useAuth();
  const { setBaseTheme, setMode } = useTheme();

  // Sync server-side theme/mode preferences into ThemeContext when user logs in or loads
  useEffect(() => {
    if (!user) return;
    setBaseTheme(user.theme as BaseTheme);
    if (user.mode === 'light' || user.mode === 'dark') setMode(user.mode);
  }, [user, setBaseTheme, setMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="animate-pulse text-sm text-slate-400">
          Warming up Linklater…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4">
        <AuthForm />
      </div>
    );
  }

  return <AppShell />;
}
