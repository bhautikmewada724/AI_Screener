import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '../api/client';
import { getUserAuditTrail, getUserById, updateUserRole, updateUserStatus } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import { USER_ROLES, USER_STATUSES } from '../constants/users';
import ErrorState from '../components/ui/ErrorState';

const selectClasses =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-navy shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';

const AdminUserDetailPage = () => {
  const { userId = '' } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const invalidateUserCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    queryClient.invalidateQueries({ queryKey: ['admin-user-audit', userId] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const userQuery = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => getUserById(userId, token),
    enabled: !!token && !!userId
  });

  const auditQuery = useQuery({
    queryKey: ['admin-user-audit', userId],
    queryFn: () => getUserAuditTrail(userId, token),
    enabled: !!token && !!userId
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) => updateUserRole(userId, role, token),
    onSuccess: () => {
      setActionError(null);
      setActionMessage('Role updated');
      invalidateUserCaches();
    },
    onError: (error: unknown) => {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : 'Failed to update role');
    }
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateUserStatus(userId, status, token),
    onSuccess: () => {
      setActionError(null);
      setActionMessage('Status updated');
      invalidateUserCaches();
    },
    onError: (error: unknown) => {
      setActionMessage(null);
      setActionError(error instanceof Error ? error.message : 'Failed to update status');
    }
  });

  const user = userQuery.data?.user;
  const auditEvents = auditQuery.data?.events ?? [];
  const isUnauthorized =
    userQuery.isError &&
    (((userQuery.error as ApiError)?.status === 401) || ((userQuery.error as ApiError)?.status === 403));

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

  const formatAuditLine = (event: any) => {
    const changes: string[] = [];
    if (event?.before?.role || event?.after?.role) {
      changes.push(`role: ${event.before?.role ?? '—'} → ${event.after?.role ?? '—'}`);
    }
    if (event?.before?.status || event?.after?.status) {
      changes.push(`status: ${event.before?.status ?? '—'} → ${event.after?.status ?? '—'}`);
    }
    if (changes.length === 0) return event.action;
    return `${event.action} (${changes.join(', ')})`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="User Detail" subtitle="Review profile, role, status, and account activity." />

      {userQuery.isLoading && <p className="text-sm text-brand-ash">Loading user…</p>}

      {isUnauthorized && (
        <ErrorState message="You are not authorized to view this user." />
      )}

      {userQuery.isError && !isUnauthorized && (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          Failed to load user.
        </p>
      )}

      {actionError && (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{actionError}</p>
      )}
      {actionMessage && (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionMessage}
        </p>
      )}

      {user && (
        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <article className="card space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-brand-navy">{user.name}</h2>
              <p className="text-sm text-brand-ash">{user.email}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-brand-ash">
                Role
                <select
                  value={user.role}
                  onChange={(event) => {
                    const nextRole = event.target.value;
                    if (!confirmRoleChange(user.role, nextRole)) return;
                    setActionMessage(null);
                    setActionError(null);
                    roleMutation.mutate(nextRole);
                  }}
                  disabled={roleMutation.isPending}
                  className={selectClasses}
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-brand-ash">
                Status
                <select
                  value={user.status || 'active'}
                  onChange={(event) => {
                    const nextStatus = event.target.value;
                    if (!confirmStatusChange(nextStatus)) return;
                    setActionMessage(null);
                    setActionError(null);
                    statusMutation.mutate(nextStatus);
                  }}
                  disabled={statusMutation.isPending}
                  className={selectClasses}
                >
                  {USER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-brand-navy">
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-ash">Last login</span>
                <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</span>
              </div>
            </div>
          </article>

          <article className="card space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-ash">Account Status</span>
              <span className={`status-badge ${user.status || 'active'}`}>{user.status || 'active'}</span>
            </div>
            <div className="space-y-2 text-sm text-brand-navy">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-ash">Created</p>
                <p>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-ash">Updated</p>
                <p>{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '—'}</p>
              </div>
            </div>
          </article>
        </section>
      )}

      {user && (
        <article className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-ash">Recent audit history</h3>
            <span className="text-xs text-brand-ash">Last 20 events</span>
          </div>
          {auditQuery.isLoading && <p className="text-sm text-brand-ash">Loading audit history…</p>}
          {auditQuery.isError && (
            <ErrorState
              message={`Failed to load audit history: ${(auditQuery.error as Error).message}`}
              onRetry={() => auditQuery.refetch()}
            />
          )}
          {!auditQuery.isLoading && auditEvents.length === 0 && (
            <p className="text-sm text-brand-ash">No audit events yet for this user.</p>
          )}
          {auditEvents.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {auditEvents.map((event) => (
                <li key={event.id} className="py-2 text-sm text-brand-navy">
                  <div className="flex items-center justify-between">
                    <span>{formatAuditLine(event)}</span>
                    <span className="text-xs text-brand-ash">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </div>
  );
};

export default AdminUserDetailPage;


