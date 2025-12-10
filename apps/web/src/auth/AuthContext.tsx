import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../lib/api';

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('linklater_token');
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const me = await getMe();
        setUser(me);
      } catch (e) {
        console.error('Failed to fetch current user', e);
        localStorage.removeItem('linklater_token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser(me);
  };

  const register = async (email: string, password: string) => {
    await apiRegister(email, password);
    await login(email, password);
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
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
