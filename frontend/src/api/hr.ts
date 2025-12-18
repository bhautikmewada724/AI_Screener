import { apiRequest, withQuery } from './client';
import type {
  ApplicationRecord,
  AuditEventRecord,
  JobDescription,
  ScoringConfig,
  PaginatedResponse,
  ReviewNote
} from '../types/api';

export const fetchJobs = (token?: string) => {
  return apiRequest<PaginatedResponse<JobDescription>>('/hr/jobs', {
    token
  });
};

export const fetchJobById = (jobId: string, token?: string) => {
  return apiRequest<JobDescription>(`/hr/jobs/${jobId}`, { token });
};

export const fetchScoringConfig = (jobId: string, token?: string) => {
  return apiRequest<{ scoringConfig: ScoringConfig }>(`/hr/jobs/${jobId}/scoring-config`, { token });
};

export const updateScoringConfig = (jobId: string, payload: ScoringConfig, token?: string) => {
  return apiRequest<{ scoringConfig: ScoringConfig }>(`/hr/jobs/${jobId}/scoring-config`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload)
  });
};

export const fetchReviewQueue = (params: { jobId: string; status?: string; page?: number; limit?: number }, token?: string) => {
  const { jobId, status, page, limit } = params;
  const path = withQuery(`/hr/jobs/${jobId}/review-queue`, { status, page, limit });
  return apiRequest<PaginatedResponse<ApplicationRecord>>(path, { token });
};

export const updateApplicationStatus = (
  applicationId: string,
  payload: { status: string; reviewStage?: string; decisionReason?: string },
  token?: string
) => {
  return apiRequest(`/hr/applications/${applicationId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload)
  });
};

export const refreshApplicationScore = (applicationId: string, token?: string) => {
  return apiRequest(`/hr/applications/${applicationId}/score-refresh`, {
    method: 'POST',
    token
  });
};

export const fetchComments = (applicationId: string, token?: string) => {
  return apiRequest<{ data: ReviewNote[] }>(`/hr/applications/${applicationId}/comments`, { token });
};

export const createComment = (
  applicationId: string,
  payload: { body: string; visibility?: 'shared' | 'private' },
  token?: string
) => {
  return apiRequest(`/hr/applications/${applicationId}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });
};

export const fetchAuditTrail = (applicationId: string, token?: string) => {
  return apiRequest<{ data: AuditEventRecord[] }>(`/hr/applications/${applicationId}/audit`, { token });
};


