import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserById, updateUserRole, updateUserStatus } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';

const roleOptions = ['admin', 'hr', 'candidate'];
const statusOptions = ['active', 'inactive', 'banned'];

const selectClasses =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-navy shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';

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
    <div className="space-y-6">
      <PageHeader title="User Detail" subtitle="Review profile, role, status, and account activity." />

      {userQuery.isLoading && <p className="text-sm text-brand-ash">Loading user…</p>}
      {userQuery.isError && (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          Failed to load user.
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
                  onChange={(event) => roleMutation.mutate(event.target.value)}
                  disabled={roleMutation.isPending}
                  className={selectClasses}
                >
                  {roleOptions.map((role) => (
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
                  onChange={(event) => statusMutation.mutate(event.target.value)}
                  disabled={statusMutation.isPending}
                  className={selectClasses}
                >
                  {statusOptions.map((status) => (
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
    </div>
  );
};

export default AdminUserDetailPage;


