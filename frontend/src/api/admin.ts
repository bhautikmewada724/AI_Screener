import { apiRequest, withQuery } from './client';
import type { PaginatedResponse, UserProfile } from '../types/api';

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

export const getUserById = (userId: string, token?: string) => {
  return apiRequest<{ user: UserProfile }>(`/admin/users/${userId}`, { token });
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
    users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
    jobs: { total: number; byStatus: Record<string, number> };
    applications: { total: number; byStatus: Record<string, number> };
  }>('/admin/stats/overview', { token });
};


