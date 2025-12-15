import type { ReactNode } from 'react';

/**
 * Auth is now managed by Redux Toolkit (`store/slices/authSlice`).
 * This no-op provider remains only to avoid breaking legacy imports.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => <>{children}</>;


