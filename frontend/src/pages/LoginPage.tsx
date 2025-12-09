import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'admin') {
        navigate('/admin/overview');
      } else if (loggedInUser.role === 'hr') {
        navigate('/hr/dashboard');
      } else {
        navigate('/candidate/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, #e0f2fe, #f8fafc 70%)',
        padding: '2rem'
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '1rem' }}
      >
        <div>
          <h2 style={{ margin: 0 }}>AI Screener</h2>
          <p style={{ marginBottom: 0, color: '#475569' }}>Admin &amp; HR Console Login</p>
        </div>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5f5' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5f5' }}
          />
        </label>

        {error && (
          <div style={{ color: '#b91c1c', fontSize: '0.9rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button
          className="btn"
          style={{ background: '#0f172a', color: '#fff', padding: '0.85rem', fontSize: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <small style={{ color: '#64748b' }}>
          Use admin or HR credentials provisioned via `/auth/register`. candidates should continue using the
          mobile/desktop experience designed for them.
        </small>
      </form>
    </div>
  );
};

export default LoginPage;


