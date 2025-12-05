import { Outlet, Navigate, NavLink } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/admin/overview', label: 'System Overview' },
  { to: '/admin/users', label: 'User Management' }
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
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '260px 1fr' }}>
      <aside style={{ background: '#0f172a', color: '#fff', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Admin Console</h2>
          <small style={{ opacity: 0.75 }}>Welcome, {user.name}</small>
        </div>
        <nav style={{ display: 'grid', gap: '0.5rem' }}>
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
        <button
          className="btn"
          style={{ marginTop: 'auto', background: '#e2e8f0', color: '#0f172a' }}
          onClick={logout}
        >
          Logout
        </button>
      </aside>
      <main style={{ background: '#f8fafc', padding: '2rem', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;


