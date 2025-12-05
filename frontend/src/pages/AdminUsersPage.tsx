import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { listUsers, updateUserRole, updateUserStatus } from '../api/admin';
import { updateJobOwner } from '../api/jobs';
import { useAuth } from '../hooks/useAuth';

const roles = ['admin', 'hr', 'candidate'];
const statuses = ['active', 'inactive', 'banned'];

const AdminUsersPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ role: '', status: '', search: '' });

  const usersQuery = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () =>
      listUsers(
        {
          page: 1,
          limit: 50,
          role: filters.role || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined
        },
        token
      ),
    enabled: !!token
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) => updateUserStatus(userId, status, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.5rem' }}>User Management</h1>
        <p style={{ color: '#475569' }}>Search, filter, and manage user roles and account status.</p>
      </header>

      <section className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name or email"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            style={{ flex: 1, minWidth: 220, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
          />
          <select
            value={filters.role}
            onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
            style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card" style={{ overflow: 'auto' }}>
        {usersQuery.isLoading && <p>Loading users…</p>}
        {usersQuery.isError && (
          <p style={{ color: '#b91c1c' }}>Failed to load users: {(usersQuery.error as Error).message}</p>
        )}

        {usersQuery.data?.data && usersQuery.data.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.data.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      <Link to={`/admin/users/${user.id}`}>{user.name}</Link>
                    </div>
                    <small style={{ color: '#64748b' }}>{user.email}</small>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`status-badge ${user.status || 'active'}`}>{user.status || 'active'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <select
                        value={user.role}
                        onChange={(e) => roleMutation.mutate({ userId: user.id, role: e.target.value })}
                        disabled={roleMutation.isPending}
                        style={{ borderRadius: '0.5rem' }}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <select
                        value={user.status || 'active'}
                        onChange={(e) => statusMutation.mutate({ userId: user.id, status: e.target.value })}
                        disabled={statusMutation.isPending}
                        style={{ borderRadius: '0.5rem' }}
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !usersQuery.isLoading && <p style={{ color: '#94a3b8' }}>No users found.</p>
        )}
      </section>
    </div>
  );
};

export default AdminUsersPage;


