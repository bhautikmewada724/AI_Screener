import { apiRequest, withQuery } from './client';

export const updateJobOwner = (jobId: string, payload: { hrId: string }, token?: string) => {
  return apiRequest(`/hr/jobs/${jobId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload)
  });
};

export const fetchJobs = (
  token?: string,
  params?: { page?: number; limit?: number; search?: string; hrId?: string }
) => {
  const path = withQuery('/hr/jobs', {
    page: params?.page,
    limit: params?.limit,
    search: params?.search,
    hrId: params?.hrId
  });
  return apiRequest<{ data: Array<any>; pagination: { total: number } }>(path, { token });
};

export const deleteJob = (jobId: string, token?: string) => {
  return apiRequest(`/hr/jobs/${jobId}`, {
    method: 'DELETE',
    token,
    skipJson: true
  });
};

export const getJobById = (jobId: string, token?: string) => {
  return apiRequest(`/hr/jobs/${jobId}`, { token });
};

export const createJob = (payload: unknown, token?: string) => {
  return apiRequest('/hr/jobs', {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });
};

export const updateJob = (jobId: string, payload: unknown, token?: string) => {
  return apiRequest(`/hr/jobs/${jobId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload)
  });
};


