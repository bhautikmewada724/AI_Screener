import { Outlet, Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AppShell } from './AppShell';
import { adminNavItems } from './navItems';

const AdminLayout = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
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


