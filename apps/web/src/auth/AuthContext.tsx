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

export interface User {
  userId: string;
  email: string;
  mode: string;
  theme: string;
}

interface AuthContextValue {
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
  updateEmail: (email: string) => void;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('linklater_token');
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const me = await getMe();
        setUser({
          userId: me.userId,
          email: me.email,
          mode: me.mode,
          theme: me.theme,
        });
      } catch (error) {
        console.error('Failed to fetch current user', error);
        localStorage.removeItem('linklater_token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser({
      userId: me.userId,
      email: me.email,
      mode: me.mode,
      theme: me.theme,
    });
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
    setUser((previous) => (previous ? { ...previous, email } : previous));
  };

  const value: AuthContextValue = {
    loading,
    login,
    logout,
    register,
    updateEmail,
    user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');

  return context;
}
