import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '../lib/api';
import { useTheme, type BaseTheme } from '../theme/ThemeContext';

interface User {
  userId: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateEmail: (email: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setBaseTheme, setMode } = useTheme();

  useEffect(() => {
    const token = localStorage.getItem('linklater_token');
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const me = await getMe();
        setUser({ userId: me.userId, email: me.email });
        if (me.theme) setBaseTheme(me.theme as BaseTheme);
        if (me.mode === 'light' || me.mode === 'dark') setMode(me.mode);
      } catch (e) {
        console.error('Failed to fetch current user', e);
        localStorage.removeItem('linklater_token');
      } finally {
        setLoading(false);
      }
    })();
  }, [setBaseTheme, setMode]);

  const login = async (email: string, password: string) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser({ userId: me.userId, email: me.email });
    if (me.theme) setBaseTheme(me.theme as BaseTheme);
    if (me.mode === 'light' || me.mode === 'dark') setMode(me.mode);
  };

  const register = async (email: string, password: string) => {
    await apiRegister(email, password);
    await login(email, password);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const updateEmail = (email: string) => {
    setUser((prev) => (prev ? { ...prev, email } : prev));
  };

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
    updateEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
