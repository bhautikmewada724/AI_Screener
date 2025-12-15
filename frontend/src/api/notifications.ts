import { apiRequest, withQuery } from './client';
import type { NotificationRecord, NotificationPreference, PaginatedResponse } from '../types/api';

export const fetchNotifications = (params: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  type?: string;
  fromDate?: string;
  toDate?: string;
  token?: string;
}) => {
  const path = withQuery('/api/notifications', {
    page: params.page,
    pageSize: params.pageSize,
    unreadOnly: params.unreadOnly,
    type: params.type,
    fromDate: params.fromDate,
    toDate: params.toDate
  });
  return apiRequest<{ items: NotificationRecord[]; pageInfo: PaginatedResponse<unknown>['pagination']; unreadCount: number }>(path, {
    token: params.token
  });
};

export const markRead = (notificationIds: string[], token?: string) =>
  apiRequest<{ updated: number; unreadCount: number }>('/api/notifications/mark-read', {
    method: 'POST',
    token,
    body: JSON.stringify({ notificationIds })
  });

export const markAllRead = (token?: string) =>
  apiRequest<{ updated: number; unreadCount: number }>('/api/notifications/mark-all-read', {
    method: 'POST',
    token,
    body: JSON.stringify({})
  });

export const fetchPreferences = (token?: string) =>
  apiRequest<{ preferences: NotificationPreference[] }>('/api/notification-preferences', { token });

export const updatePreferences = (preferences: NotificationPreference[], token?: string) =>
  apiRequest<{ ok: boolean }>('/api/notification-preferences', {
    method: 'PUT',
    token,
    body: JSON.stringify({ preferences })
  });




