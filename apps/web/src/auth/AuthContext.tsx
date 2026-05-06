import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearStoredToken,
  getMe,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  resendVerificationEmail as apiResendVerificationEmail,
} from '../lib/api';

export interface User {
  email: string;
  emailVerifiedAt: string | null;
  pendingEmail: string | null;
  mode: string;
  theme: string;
  userId: string;
}

interface AuthContextValue {
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  setPendingEmail: (email: string) => void;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getStoredToken();
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
          emailVerifiedAt: me.emailVerifiedAt,
          pendingEmail: me.pendingEmail,
          mode: me.mode,
          theme: me.theme,
        });
      } catch (error) {
        console.error('Failed to fetch current user', error);
        clearStoredToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser({
      userId: me.userId,
      email: me.email,
      emailVerifiedAt: me.emailVerifiedAt,
      pendingEmail: me.pendingEmail,
      mode: me.mode,
      theme: me.theme,
    });
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await apiRegister(email, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    await apiResendVerificationEmail();
  }, []);

  const setPendingEmail = useCallback((email: string) => {
    setUser((previous) =>
      previous ? { ...previous, pendingEmail: email } : previous,
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      login,
      logout,
      register,
      resendVerificationEmail,
      setPendingEmail,
      user,
    }),
    [
      loading,
      login,
      logout,
      register,
      resendVerificationEmail,
      setPendingEmail,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');

  return context;
}
