import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserById, updateUserRole, updateUserStatus } from '../api/admin';
import { useAuth } from '../hooks/useAuth';

const roleOptions = ['admin', 'hr', 'candidate'];
const statusOptions = ['active', 'inactive', 'banned'];

const AdminUserDetailPage = () => {
  const { userId = '' } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => getUserById(userId, token),
    enabled: !!token && !!userId
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) => updateUserRole(userId, role, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateUserStatus(userId, status, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
  });

  const user = userQuery.data?.user;

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.5rem' }}>User Detail</h1>
        <p style={{ color: '#475569' }}>Review profile, role, status, and recent activity.</p>
      </header>

      {userQuery.isLoading && <p>Loading user…</p>}
      {userQuery.isError && <p style={{ color: '#b91c1c' }}>Failed to load user.</p>}

      {user && (
        <>
          <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>{user.name}</h2>
              <p style={{ margin: 0, color: '#64748b' }}>{user.email}</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <small style={{ color: '#94a3b8' }}>Role</small>
                <select
                  value={user.role}
                  onChange={(e) => roleMutation.mutate(e.target.value)}
                  disabled={roleMutation.isPending}
                  style={{ marginTop: '0.25rem', borderRadius: '0.5rem', padding: '0.5rem' }}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <small style={{ color: '#94a3b8' }}>Status</small>
                <select
                  value={user.status || 'active'}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  disabled={statusMutation.isPending}
                  style={{ marginTop: '0.25rem', borderRadius: '0.5rem', padding: '0.5rem' }}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <small style={{ color: '#94a3b8' }}>Last Login</small>
                <p style={{ margin: 0 }}>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </section>
          <section className="card" style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Account Status</span>
              <span className={`status-badge ${user.status || 'active'}`}>{user.status || 'active'}</span>
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <small style={{ color: '#94a3b8' }}>Created</small>
              <span>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</span>
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <small style={{ color: '#94a3b8' }}>Updated</small>
              <span>{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '—'}</span>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminUserDetailPage;


