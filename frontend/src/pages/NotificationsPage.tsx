import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { fetchNotifications, markAllRead, markRead } from '../api/notifications';
import { useAuth } from '../hooks/useAuth';

const NotificationsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ type: '', unreadOnly: false });
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notifications', page, filters],
    queryFn: () =>
      fetchNotifications({
        page,
        pageSize: 20,
        unreadOnly: filters.unreadOnly,
        type: filters.type || undefined,
        token
      }),
    enabled: Boolean(token)
  });

  const items = useMemo(() => data?.items || [], [data]);

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    await markRead([id], token);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'preview'] });
  };

  const handleMarkAll = async () => {
    if (!token) return;
    await markAllRead(token);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'preview'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">Notifications</h1>
          <p className="text-sm text-brand-ash">
            Manage and review your notification history. Unread count: {data?.unreadCount ?? 0}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter by type"
            className="input input-bordered input-sm"
            value={filters.type}
            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-brand-navy">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, unreadOnly: e.target.checked }))}
            />
            Unread only
          </label>
          <button className="btn btn-primary btn-sm" onClick={handleMarkAll}>
            Mark all read
          </button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-brand-ash">Loading...</div>}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as any)?.message || 'Failed to load notifications. Please try again.'}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 px-4 py-3">
              <div className="mt-1 h-2 w-2 rounded-full" style={{ background: item.readAt ? '#cbd5e1' : '#10b981' }} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-navy">{item.title}</p>
                {item.body && <p className="text-sm text-brand-ash">{item.body}</p>}
                <div className="mt-1 text-xs text-brand-ash">
                  Type: {item.type} · Created: {new Date(item.createdAt || '').toLocaleString()}
                </div>
              </div>
              {!item.readAt && (
                <button className="text-xs font-semibold text-brand-navy hover:underline" onClick={() => handleMarkRead(item.id)}>
                  Mark read
                </button>
              )}
            </div>
          ))}
          {!items.length && !isLoading && <div className="px-4 py-6 text-center text-sm text-brand-ash">No notifications found.</div>}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;




