import { Outlet, Navigate, NavLink } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/admin/overview', label: 'System Overview' },
  { to: '/admin/users', label: 'User Management' },
  { to: '/admin/jobs', label: 'Job Management' }
];

const AdminLayout = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="sidebar-shell">
      <aside className="sidebar-panel">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-white/60">AI Screener</p>
          <h2 className="text-2xl font-semibold">Admin Console</h2>
          <small className="text-white/70">Welcome, {user.name}</small>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary mt-auto justify-center" onClick={logout}>
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

export default AdminLayout;


