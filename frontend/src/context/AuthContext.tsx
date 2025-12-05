import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { UserProfile } from '../types/api';
import { apiRequest } from '../api/client';

interface AuthState {
  user?: UserProfile;
  token?: string;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
}

const STORAGE_KEY = 'ai-screener-auth';

export const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isBootstrapping: true,
  async login() {
    return {
      id: '',
      name: '',
      email: '',
      role: 'candidate'
    };
  },
  logout() {},
  async refreshCurrentUser() {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | undefined>();
  const [user, setUser] = useState<UserProfile | undefined>();
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsBootstrapping(false);
  }, []);

  const persist = useCallback((payload?: { token?: string; user?: UserProfile }) => {
    if (!payload?.token || !payload.user) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<{ user: UserProfile; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setToken(response.token);
      setUser(response.user);
      persist({ token: response.token, user: response.user });
      return response.user;
    },
    [persist]
  );

  const logout = useCallback(() => {
    setToken(undefined);
    setUser(undefined);
    persist(undefined);
  }, [persist]);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiRequest<{ user: UserProfile }>('/auth/me', { token });
      setUser(response.user);
      persist({ token, user: response.user });
    } catch {
      logout();
    }
  }, [logout, persist, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      refreshCurrentUser,
      isAuthenticated: Boolean(user && token),
      isBootstrapping
    }),
    [isBootstrapping, login, logout, refreshCurrentUser, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


