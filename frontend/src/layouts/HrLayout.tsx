import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const HrLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <header
        style={{
          background: '#0f172a',
          color: '#fff',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <strong>AI Screener</strong> · HR Workflows
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <small style={{ opacity: 0.85, textTransform: 'uppercase' }}>{user?.role}</small>
          </div>
          <button className="btn" style={{ background: '#f8fafc', color: '#0f172a' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <main style={{ padding: '2rem', minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default HrLayout;


