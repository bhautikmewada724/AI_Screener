import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import RoleLayout from '../RoleLayout';
import { AuthContext } from '../../context/AuthContext';
import type { UserProfile } from '../../types/api';

const renderWithAuth = (
  ui: React.ReactNode,
  overrides: Partial<React.ComponentProps<typeof AuthContext.Provider>['value']> = {}
) => {
  const user: UserProfile = {
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    role: (overrides.user as UserProfile)?.role || 'hr'
  };

  const value = {
    user,
    token: 'token',
    isAuthenticated: true,
    isBootstrapping: false,
    lastAuthError: null,
    login: vi.fn(),
    logout: vi.fn(),
    refreshCurrentUser: vi.fn(),
    ...overrides
  };

  return render(<AuthContext.Provider value={value}>{ui}</AuthContext.Provider>);
};

describe('RoleLayout', () => {
  it('redirects unauthenticated users to login', () => {
    renderWithAuth(
      <MemoryRouter initialEntries={['/hr/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            element={<RoleLayout allowedRoles={['hr', 'admin']} navRole="hr" />}
          >
            <Route path="/hr/dashboard" element={<div>HR Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
      { isAuthenticated: false, user: undefined }
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('blocks users with wrong role', () => {
    renderWithAuth(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <Routes>
          <Route
            element={<RoleLayout allowedRoles={['admin']} navRole="admin" />}
          >
            <Route path="/admin/overview" element={<div>Admin Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
      { user: { id: 'u2', name: 'HR', email: 'hr@example.com', role: 'hr' } }
    );

    expect(screen.getByText(/Not authorized/i)).toBeInTheDocument();
  });

  it('renders shell and children when role allowed', () => {
    renderWithAuth(
      <MemoryRouter initialEntries={['/candidate/dashboard']}>
        <Routes>
          <Route
            element={<RoleLayout allowedRoles={['candidate']} navRole="candidate" />}
          >
            <Route path="/candidate/dashboard" element={<div>Candidate Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
      { user: { id: 'u3', name: 'Cand', email: 'c@example.com', role: 'candidate' } }
    );

    expect(screen.getByText('Candidate Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });
});


