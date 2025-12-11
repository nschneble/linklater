import AuthForm from './components/AuthForm';
import AppShell from './AppShell';
import { useAuth } from './auth/AuthContext';

export default function App() {
  const { user, loading } = useAuth();

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
