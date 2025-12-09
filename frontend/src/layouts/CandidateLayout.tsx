import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { AppShell } from './AppShell';
import { candidateNavItems } from './navItems';

const CandidateLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell title="Candidate Portal" subtitle={`Welcome, ${user?.name}`} navItems={candidateNavItems} onLogout={handleLogout}>
      <Outlet />
    </AppShell>
  );
};

export default CandidateLayout;

