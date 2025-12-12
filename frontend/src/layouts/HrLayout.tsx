import { Outlet, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AppShell } from './AppShell';
import { hrNavItems } from './navItems';
import NotAuthorized from '../components/ui/NotAuthorized';

const HrLayout = () => {
  const { user, logout, isAuthenticated, isBootstrapping, lastAuthError } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ message: lastAuthError || 'Please sign in.' }} replace />;
  }

  if (user.role !== 'hr' && user.role !== 'admin') {
    return <NotAuthorized message="HR workspace is restricted to HR and Admin users." />;
  }

  return (
    <AppShell title="HR Workspace" subtitle={`Signed in as ${user?.name ?? ''}`} navItems={hrNavItems} onLogout={handleLogout}>
      <Outlet />
    </AppShell>
  );
};

export default HrLayout;


