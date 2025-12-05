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
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-6 bg-brand-navy px-6 py-8 text-white">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-white/60">AI Screener</p>
          <h2 className="text-2xl font-semibold">Admin Console</h2>
          <small className="text-white/70">Welcome, {user.name}</small>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `admin-nav-link ${isActive ? 'active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary mt-auto justify-center" onClick={logout}>
          Logout
        </button>
      </aside>
      <main className="bg-slate-50 p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;


