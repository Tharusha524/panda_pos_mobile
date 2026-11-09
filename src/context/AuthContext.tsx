import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { authService } from '@/services/api/authService';
import { tokenStorage } from '@/services/storage/tokenStorage';
import type { LoginCredentials, User } from '@/types/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const [token, storedUser] = await Promise.all([
        tokenStorage.getToken(),
        tokenStorage.getUser(),
      ]);

      if (!token) {
        setUser(null);
        return;
      }

      if (storedUser) {
        setUser(storedUser);
      }

      const freshUser = await authService.fetchUser();
      setUser(freshUser);
      await tokenStorage.setUser(freshUser);
    } catch {
      await tokenStorage.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Re-read the profile when the app returns to the foreground so permission
  // changes made on the website apply without signing out. Errors are ignored
  // — a weak network must never log the user out.
  const lastForegroundRefresh = useRef(0);
  const isSignedIn = !!user;
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    const subscription = AppState.addEventListener('change', async state => {
      if (state !== 'active' || Date.now() - lastForegroundRefresh.current < 30000) {
        return;
      }
      lastForegroundRefresh.current = Date.now();
      try {
        const freshUser = await authService.fetchUser();
        if (await tokenStorage.getToken()) {
          setUser(freshUser);
          await tokenStorage.setUser(freshUser);
        }
      } catch {
        // keep the current session
      }
    });
    return () => subscription.remove();
  }, [isSignedIn]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { token, user: loggedInUser } = await authService.login(credentials);
    await tokenStorage.setToken(token);
    await tokenStorage.setUser(loggedInUser);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Clear local session even if server logout fails
    } finally {
      await tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const freshUser = await authService.fetchUser();
    setUser(freshUser);
    await tokenStorage.setUser(freshUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
