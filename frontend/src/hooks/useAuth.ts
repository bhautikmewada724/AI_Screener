import { useCallback, useMemo } from 'react';

import { apiRequest } from '../api/client';
import type { UserProfile } from '../types/api';
import { clearSession, setAuthError, setSession, setUser } from '../store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<{ user: UserProfile; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      dispatch(setSession({ token: response.token, user: response.user, lastAuthEvent: 'login' }));
      dispatch(setAuthError(null));
      return response.user;
    },
    [dispatch]
  );

  const logout = useCallback(() => {
    dispatch(clearSession());
  }, [dispatch]);

  const refreshCurrentUser = useCallback(async () => {
    if (!auth.token) return;
    try {
      const response = await apiRequest<{ user: UserProfile }>('/auth/me', { token: auth.token });
      dispatch(setUser(response.user));
      dispatch(setAuthError(null));
    } catch {
      dispatch(setAuthError('Session expired. Please sign in again.'));
      dispatch(clearSession());
    }
  }, [auth.token, dispatch]);

  return useMemo(
    () => ({
      user: auth.user || undefined,
      token: auth.token || undefined,
      login,
      logout,
      refreshCurrentUser,
      isAuthenticated: auth.status === 'authenticated',
      isBootstrapping: !auth.isHydrated,
      lastAuthError: auth.lastAuthError
    }),
    [auth, login, logout, refreshCurrentUser]
  );
};


