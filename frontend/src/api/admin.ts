import { apiRequest, withQuery } from './client';
import type { PaginatedResponse, UserAuditEvent, UserProfile } from '../types/api';

interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
}

export const listUsers = (params: ListUsersParams, token?: string) => {
  const path = withQuery('/admin/users', {
    page: params.page,
    limit: params.limit,
    role: params.role,
    status: params.status,
    search: params.search
  });
  return apiRequest<PaginatedResponse<UserProfile>>(path, { token });
};

export const createUser = (
  payload: { name: string; email: string; password: string; role?: string },
  token?: string
) => {
  return apiRequest<{ user: UserProfile }>('/admin/users', {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });
};

export const getUserById = (userId: string, token?: string) => {
  return apiRequest<{ user: UserProfile }>(`/admin/users/${userId}`, { token });
};

export const getUserAuditTrail = (userId: string, token?: string, limit = 20) => {
  const path = withQuery(`/admin/users/${userId}/audit`, { limit });
  return apiRequest<{ events: UserAuditEvent[] }>(path, { token });
};

export const updateUserRole = (userId: string, role: string, token?: string) => {
  return apiRequest<{ user: UserProfile }>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ role })
  });
};

export const updateUserStatus = (userId: string, status: string, token?: string) => {
  return apiRequest<{ user: UserProfile }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status })
  });
};

export const fetchSystemOverview = (token?: string) => {
  return apiRequest<{
    users: {
      total: number;
      byRole: Record<string, number>;
      byStatus: Record<string, number>;
      createdLast7Days?: number;
    };
    jobs: { total: number; byStatus: Record<string, number>; createdLast30Days?: number };
    applications: { total: number; byStatus: Record<string, number>; createdLast30Days?: number };
    health?: { lastAuditEventAt: string | null };
  }>('/admin/stats/overview', { token });
};


