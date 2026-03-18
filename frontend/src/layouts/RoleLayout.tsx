import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AppShell } from './AppShell';
import NotAuthorized from '../components/ui/NotAuthorized';
import { ROLE_CONFIG, RoleKey } from '../config/roleConfig';
import type { UserRole } from '../types/api';

interface RoleLayoutProps {
  allowedRoles: UserRole[];
  navRole?: RoleKey | 'auto';
}

const RoleLayout = ({ allowedRoles, navRole = 'auto' }: RoleLayoutProps) => {
  const { isAuthenticated, isBootstrapping, user, lastAuthError, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#475569' }}>
        Verifying session…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname, message: lastAuthError || 'Please sign in.' }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <NotAuthorized />;
  }

  const resolvedNavRole: RoleKey | undefined =
    navRole === 'auto'
      ? (user.role as RoleKey)
      : navRole;

  const config = resolvedNavRole ? ROLE_CONFIG[resolvedNavRole] : undefined;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell
      title={config?.title || 'Workspace'}
      subtitle={config?.subtitle?.(user.name)}
      navItems={config?.navItems || []}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  );
};

export default RoleLayout;


