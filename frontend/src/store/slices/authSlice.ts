import { createSlice, type Middleware, type PayloadAction } from '@reduxjs/toolkit';

import type { UserProfile } from '../../types/api';

export type AuthStatus = 'anonymous' | 'authenticated';

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  status: AuthStatus;
  isHydrated: boolean;
  lastAuthEvent?: string | null;
  lastAuthError?: string | null;
}

const AUTH_STORAGE_KEY = 'ai-screener-auth';

const readStoredAuth = (): Pick<AuthState, 'token' | 'user'> => {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return { token: null, user: null };

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.token === 'string' && parsed?.user) {
      return { token: parsed.token, user: parsed.user as UserProfile };
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return { token: null, user: null };
};

const buildInitialState = (): AuthState => {
  const { token, user } = readStoredAuth();
  return {
    token,
    user,
    status: token && user ? 'authenticated' : 'anonymous',
    isHydrated: true,
    lastAuthEvent: token && user ? 'hydrated' : null,
    lastAuthError: null
  };
};

const initialState: AuthState = buildInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (
      state,
      action: PayloadAction<{ token: string; user: UserProfile; lastAuthEvent?: string | null }>
    ) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.status = 'authenticated';
      state.lastAuthEvent = action.payload.lastAuthEvent ?? 'login';
      state.lastAuthError = null;
    },
    clearSession: (state) => {
      state.token = null;
      state.user = null;
      state.status = 'anonymous';
      state.lastAuthEvent = 'logout';
      state.lastAuthError = null;
    },
    setUser: (state, action: PayloadAction<UserProfile | null>) => {
      state.user = action.payload;
      state.status = state.token && action.payload ? 'authenticated' : 'anonymous';
    },
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
      state.status = action.payload && state.user ? 'authenticated' : 'anonymous';
    },
    setAuthError: (state, action: PayloadAction<string | null>) => {
      state.lastAuthError = action.payload;
    }
  }
});

const persistAuthState = (state: AuthState) => {
  if (typeof window === 'undefined') return;
  if (state.token && state.user) {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: state.token, user: state.user })
    );
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

export const authPersistenceMiddleware: Middleware<{}, { auth: AuthState }> =
  (storeApi) => (next) => (action) => {
    const result = next(action);

    if (
      authSlice.actions.setSession.match(action) ||
      authSlice.actions.setToken.match(action) ||
      authSlice.actions.setUser.match(action) ||
      authSlice.actions.clearSession.match(action)
    ) {
      persistAuthState(storeApi.getState().auth);
    }

    return result;
  };

export const { setSession, clearSession, setToken, setUser, setAuthError } = authSlice.actions;

export default authSlice.reducer;

