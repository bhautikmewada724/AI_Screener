import { API_BASE_URL, apiRequest, withQuery } from './client';
import type {
  ApplicationRecord,
  JobDescription,
  Recommendation,
  ResumePayload
} from '../types/api';

export const fetchMyResumes = (token?: string) => {
  return apiRequest<ResumePayload[]>('/resume/me', { token });
};

export const uploadCandidateResume = async (file: File, token?: string) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/resume/upload`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined,
    body: formData
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Failed to upload resume');
  }

  return response.json() as Promise<{ resumeId: string }>;
};

export const fetchOpenJobs = (params: { page?: number; limit?: number; search?: string; location?: string }, token?: string) => {
  const path = withQuery('/jobs', params);
  return apiRequest<{
    data: JobDescription[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(path, { token });
};

export const fetchOpenJobById = (jobId: string, token?: string) => {
  return apiRequest<JobDescription>(`/jobs/${jobId}`, { token });
};

export const applyToJob = (payload: { jobId: string; resumeId: string }, token?: string) => {
  return apiRequest('/applications', {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });
};

export const fetchMyApplications = (token?: string) => {
  return apiRequest<{ data: ApplicationRecord[] }>('/applications/me', { token });
};

export const fetchCandidateRecommendations = (token?: string) => {
  return apiRequest<Recommendation>('/candidate/recommendations', { token });
};

export const refreshCandidateRecommendations = (token?: string) => {
  return apiRequest<Recommendation>('/candidate/recommendations/refresh', {
    method: 'POST',
    token
  });
};

export const sendRecommendationFeedback = (
  payload: { jobId: string; feedbackType: 'dismissed' | 'saved'; feedbackReason?: string },
  token?: string
) => {
  return apiRequest<Recommendation>('/candidate/recommendations/feedback', {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });
};

