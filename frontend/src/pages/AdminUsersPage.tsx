import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { createUser, listUsers, updateUserRole, updateUserStatus } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import { USER_ROLES, USER_STATUSES } from '../constants/users';
import type { PaginatedResponse, UserProfile } from '../types/api';
const inputClasses =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-brand-navy shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';

const AdminUsersPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ role: '', status: '', search: '' });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'hr' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isCreateInvalid = useMemo(() => {
    const emailPattern = /\S+@\S+\.\S+/;
    return (
      !newUser.name.trim() ||
      !newUser.email.trim() ||
      !emailPattern.test(newUser.email) ||
      !newUser.password.trim()
    );
  }, [newUser]);

  const usersQuery = useQuery<PaginatedResponse<UserProfile>>({
    queryKey: ['admin-users', filters, page, pageSize],
    queryFn: () =>
      listUsers(
        {
          page,
          limit: pageSize,
          role: filters.role || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined
        },
        token
      ),
    placeholderData: (prev) => prev,
    enabled: !!token
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role, token),
    onSuccess: () => {
      setActionMessage('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: unknown) => {
      setActionMessage(error instanceof Error ? error.message : 'Failed to update role');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: () => createUser(newUser, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setPage(1);
      setNewUser({ name: '', email: '', password: '', role: 'hr' });
      setCreateError(null);
      setCreateSuccess('User created successfully.');
    },
    onError: (error: unknown) => {
      setCreateSuccess(null);
      setCreateError(error instanceof Error ? error.message : 'Failed to create user');
    }
  });
  const handleCreateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (isCreateInvalid) {
      setCreateError('Please enter a name, valid email, and password.');
      return;
    }
    createUserMutation.mutate();
  };

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) => updateUserStatus(userId, status, token),
    onSuccess: () => {
      setActionMessage('Status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: unknown) => {
      setActionMessage(error instanceof Error ? error.message : 'Failed to update status');
    }
  });

  const pagination = usersQuery.data?.pagination;
  const totalPages = pagination?.pages ?? 1;
  const users = usersQuery.data?.data ?? [];

  const confirmRoleChange = (currentRole: string, nextRole: string) => {
    if (currentRole === 'admin' && nextRole !== 'admin') {
      return window.confirm('Demoting an admin? The last admin cannot be removed.');
    }
    return true;
  };

  const confirmStatusChange = (nextStatus: string) => {
    if (nextStatus === 'banned' || nextStatus === 'inactive') {
      return window.confirm('Change account status? This may block access for the user.');
    }
    return true;
  };

  const handlePageChange = (nextPage: number) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Search, filter, and manage user roles and account status." />

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-brand-navy">Provision user</h3>
            <p className="text-sm text-brand-ash">
              Only admins can create HR or admin accounts. New users start as active.
            </p>
          </div>
        </div>
        <form onSubmit={handleCreateUser} className="grid gap-3 lg:grid-cols-[2fr_2fr_2fr_1fr_auto]">
          <input
            type="text"
            required
            placeholder="Full name"
            value={newUser.name}
            onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
            className={inputClasses}
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={newUser.email}
            onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
            className={inputClasses}
          />
          <input
            type="password"
            required
            placeholder="Temporary password"
            value={newUser.password}
            onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
            className={inputClasses}
          />
          <select
            value={newUser.role}
            onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}
            className={inputClasses}
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={createUserMutation.isPending || isCreateInvalid}
            aria-busy={createUserMutation.isPending}
          >
            {createUserMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        {createError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{createError}</p>
        )}
        {createSuccess && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{createSuccess}</p>
        )}
      </section>

      <section className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Search name or email"
            value={filters.search}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, search: event.target.value }));
              setPage(1);
            }}
            className={inputClasses}
          />
          <select
            value={filters.role}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, role: event.target.value }));
              setPage(1);
            }}
            className={inputClasses}
          >
            <option value="">All roles</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, status: event.target.value }));
              setPage(1);
            }}
            className={inputClasses}
          >
            <option value="">All statuses</option>
            {USER_STATUSES.map((status) => (
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
        {actionMessage && (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionMessage}
          </p>
        )}
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
                {users.map((user: UserProfile) => (
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
                              onChange={(event) => {
                                const nextRole = event.target.value;
                                if (!confirmRoleChange(user.role, nextRole)) return;
                                setActionMessage(null);
                                roleMutation.mutate({ userId: user.id, role: nextRole });
                              }}
                              disabled={roleMutation.isPending}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                            >
                              {USER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <select
                              value={user.status || 'active'}
                              onChange={(event) => {
                                const nextStatus = event.target.value;
                                if (!confirmStatusChange(nextStatus)) return;
                                setActionMessage(null);
                                statusMutation.mutate({ userId: user.id, status: nextStatus });
                              }}
                              disabled={statusMutation.isPending}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-sm capitalize"
                            >
                              {USER_STATUSES.map((status) => (
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
              {users.map((user: UserProfile) => (
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
                        onChange={(event) => {
                          const nextRole = event.target.value;
                          if (!confirmRoleChange(user.role, nextRole)) return;
                          setActionMessage(null);
                          roleMutation.mutate({ userId: user.id, role: nextRole });
                        }}
                        disabled={roleMutation.isPending}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        {USER_ROLES.map((role) => (
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
                        onChange={(event) => {
                          const nextStatus = event.target.value;
                          if (!confirmStatusChange(nextStatus)) return;
                          setActionMessage(null);
                          statusMutation.mutate({ userId: user.id, status: nextStatus });
                        }}
                        disabled={statusMutation.isPending}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm capitalize"
                      >
                        {USER_STATUSES.map((status) => (
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

        {pagination && pagination.pages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || usersQuery.isFetching}
            >
              Previous
            </button>
            <span className="text-sm text-brand-ash">
              Page {pagination.page} of {pagination.pages} · {pagination.total} users
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || usersQuery.isFetching}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminUsersPage;


