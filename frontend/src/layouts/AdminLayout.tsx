import { Outlet, Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AppShell } from './AppShell';
import { adminNavItems } from './navItems';
import NotAuthorized from '../components/ui/NotAuthorized';

const AdminLayout = () => {
  const { user, logout, isAuthenticated, isBootstrapping, lastAuthError } = useAuth();

  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ message: lastAuthError || 'Please sign in.' }} replace />;
  }

  if (user.role !== 'admin') {
    return <NotAuthorized message="Admins only. Please contact an administrator if you need access." />;
  }

  return (
    <AppShell
      title="Admin Console"
      subtitle={`Welcome, ${user.name}`}
      navItems={adminNavItems}
      onLogout={logout}
    >
      <Outlet />
    </AppShell>
  );
};

export default AdminLayout;


