import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AppShell } from './AppShell';
import { hrNavItems } from './navItems';

const HrLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell title="HR Workspace" subtitle={`Signed in as ${user?.name ?? ''}`} navItems={hrNavItems} onLogout={handleLogout}>
      <Outlet />
    </AppShell>
  );
};

export default HrLayout;


