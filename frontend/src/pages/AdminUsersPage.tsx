import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { listUsers, updateUserRole, updateUserStatus } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';

const roles = ['admin', 'hr', 'candidate'];
const statuses = ['active', 'inactive', 'banned'];
const inputClasses =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-brand-navy shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';

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

  const users = usersQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Search, filter, and manage user roles and account status." />

      <section className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Search name or email"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            className={inputClasses}
          />
          <select
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
            className={inputClasses}
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
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className={inputClasses}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-brand-ash">
          Use filters to triage accounts quickly—changes apply instantly across the platform.
        </p>
      </section>

      <section className="card space-y-4">
        {usersQuery.isLoading && <p className="text-sm text-brand-ash">Loading users…</p>}
        {usersQuery.isError && (
          <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Failed to load users: {(usersQuery.error as Error).message}
          </p>
        )}

        {users.length > 0 ? (
          <>
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="table min-w-full">
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
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="font-semibold text-brand-navy">
                            <Link to={`/admin/users/${user.id}`}>{user.name}</Link>
                          </div>
                          <small className="text-brand-ash">{user.email}</small>
                        </td>
                        <td className="capitalize">{user.role}</td>
                        <td>
                          <span className={`status-badge ${user.status || 'active'}`}>{user.status || 'active'}</span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={user.role}
                              onChange={(event) => roleMutation.mutate({ userId: user.id, role: event.target.value })}
                              disabled={roleMutation.isPending}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <select
                              value={user.status || 'active'}
                              onChange={(event) =>
                                statusMutation.mutate({ userId: user.id, status: event.target.value })
                              }
                              disabled={statusMutation.isPending}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-sm capitalize"
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
              </div>
            </div>

            <div className="space-y-4 lg:hidden">
              {users.map((user) => (
                <article key={user.id} className="rounded-2xl border border-slate-100 p-4 shadow-card-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-brand-navy">{user.name}</div>
                      <small className="text-brand-ash">{user.email}</small>
                    </div>
                    <span className={`status-badge ${user.status || 'active'}`}>{user.status || 'active'}</span>
                  </div>
                  <div className="mt-2 text-sm text-brand-ash">Role · {user.role}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-brand-ash">
                      Role
                      <select
                        value={user.role}
                        onChange={(event) => roleMutation.mutate({ userId: user.id, role: event.target.value })}
                        disabled={roleMutation.isPending}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-brand-ash">
                      Status
                      <select
                        value={user.status || 'active'}
                        onChange={(event) =>
                          statusMutation.mutate({ userId: user.id, status: event.target.value })
                        }
                        disabled={statusMutation.isPending}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm capitalize"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Link to={`/admin/users/${user.id}`} className="btn btn-secondary mt-3 w-full">
                    View profile
                  </Link>
                </article>
              ))}
            </div>
          </>
        ) : (
          !usersQuery.isLoading && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-brand-ash">
              No users found for these filters.
            </p>
          )
        )}
      </section>
    </div>
  );
};

export default AdminUsersPage;


