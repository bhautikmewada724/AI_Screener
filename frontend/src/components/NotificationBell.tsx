import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { fetchNotifications, markAllRead, markRead } from '../api/notifications';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../api/client';

const POLL_MS = 30000;

const NotificationBell = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [streamSupported, setStreamSupported] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data } = useQuery({
    queryKey: ['notifications', 'preview'],
    queryFn: () =>
      fetchNotifications({ pageSize: 5, unreadOnly: false, token }).then((res) => {
        setUnreadCount(res.unreadCount || 0);
        return res;
      }),
    enabled: Boolean(token),
    refetchInterval: POLL_MS
  });

  useEffect(() => {
    if (!token || !('EventSource' in window)) {
      setStreamSupported(false);
      return;
    }
    const es = new EventSource(`${API_BASE_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = es;
    setStreamSupported(true);

    es.addEventListener('notification', (event) => {
      try {
        const parsed = JSON.parse(event.data || '{}');
        if (parsed?.unreadCount !== undefined) {
          setUnreadCount(parsed.unreadCount);
        }
      } catch {
        /* ignore */
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preview'] });
    });

    es.addEventListener('unread_count', (event) => {
      try {
        const parsed = JSON.parse(event.data || '{}');
        if (parsed?.unreadCount !== undefined) {
          setUnreadCount(parsed.unreadCount);
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener('bootstrap', (event) => {
      try {
        const parsed = JSON.parse(event.data || '{}');
        if (parsed?.unreadCount !== undefined) {
          setUnreadCount(parsed.unreadCount);
        }
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      es.close();
      setStreamSupported(false);
    };

    return () => {
      es.close();
    };
  }, [queryClient, token]);

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    await markRead([id], token);
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'preview'] });
  };

  const handleMarkAll = async () => {
    if (!token) return;
    await markAllRead(token);
    setUnreadCount(0);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'preview'] });
  };

  return (
    <div className="relative">
      <button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-navy hover:bg-slate-50"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
      >
        <span className="sr-only">Notifications</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-brand-navy">Notifications</p>
              <p className="text-xs text-brand-ash">{streamSupported ? 'Live' : 'Polling'} · Unread {unreadCount}</p>
            </div>
            <button className="text-xs font-semibold text-brand-navy hover:underline" onClick={handleMarkAll}>
              Mark all read
            </button>
          </div>
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {data?.items?.length ? (
              data.items.map((item) => (
                <div key={item.id} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="mt-1 h-2 w-2 rounded-full" style={{ background: item.readAt ? '#cbd5e1' : '#10b981' }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-navy">{item.title}</p>
                    {item.body && <p className="text-sm text-brand-ash">{item.body}</p>}
                    <div className="mt-1 flex gap-3 text-xs text-brand-ash">
                      {item.data?.deepLink && String(item.data.deepLink).startsWith('http') ? (
                        <a
                          href={String(item.data.deepLink)}
                          className="font-semibold text-brand-navy hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : item.data?.deepLink ? (
                        <Link to={String(item.data.deepLink)} className="font-semibold text-brand-navy hover:underline">
                          Open
                        </Link>
                      ) : null}
                      {!item.readAt && (
                        <button
                          className="text-xs font-semibold text-brand-navy hover:underline"
                          onClick={() => handleMarkRead(item.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-brand-ash">No notifications yet.</div>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-right">
            <Link to="/notifications" className="text-sm font-semibold text-brand-navy hover:underline" onClick={() => setIsOpen(false)}>
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;


