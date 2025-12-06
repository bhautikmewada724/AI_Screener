import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/hr/dashboard', label: 'Dashboard' },
  { to: '/hr/jobs/overview', label: 'Job Workflows', disabled: true }
];

const HrLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="sidebar-shell">
      <aside className="sidebar-panel">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-white/60">AI Screener</p>
          <h2 className="text-2xl font-semibold">HR Workspace</h2>
          <small className="text-white/70">Signed in as {user?.name}</small>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''} ${item.disabled ? 'opacity-50 pointer-events-none' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary mt-auto justify-center" onClick={handleLogout}>
          Logout
        </button>
      </aside>
      <main className="bg-brand-surface p-6 lg:p-10">
        <div className="page-shell">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default HrLayout;


