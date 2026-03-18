import { apiRequest, withQuery } from './client';
import type {
  ApplicationRecord,
  AuditEventRecord,
  JobDescription,
  JobCandidatesResponse,
  ScoringConfig,
  PaginatedResponse,
  ReviewNote,
  SuggestedCandidate
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

export const fetchJobApplications = (
  params: { jobId: string; status?: string; page?: number; limit?: number },
  token?: string
) => {
  const { jobId, status, page, limit } = params;
  const path = withQuery(`/hr/jobs/${jobId}/applications`, { status, page, limit });
  return apiRequest<PaginatedResponse<ApplicationRecord>>(path, { token });
};

export const fetchJobSuggestions = (
  jobId: string,
  token?: string,
  options?: { minScore?: number; limit?: number; refresh?: boolean }
) => {
  const path = withQuery(`/hr/jobs/${jobId}/suggestions`, {
    minScore: options?.minScore,
    limit: options?.limit,
    refresh: options?.refresh ? 'true' : undefined
  });
  return apiRequest<{ data: SuggestedCandidate[] }>(path, { token });
};

export const addCandidateToJob = (
  jobId: string,
  payload: { candidateId: string; resumeId: string },
  token?: string
) => {
  return apiRequest<{ application: ApplicationRecord }>(`/hr/jobs/${jobId}/applications`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });
};

export const fetchJobCandidates = (
  jobId: string,
  token?: string,
  options?: { minScore?: number; limit?: number; refresh?: boolean }
) => {
  const path = withQuery(`/hr/jobs/${jobId}/candidates`, {
    minScore: options?.minScore,
    limit: options?.limit,
    refresh: options?.refresh ? 'true' : undefined
  });
  return apiRequest<JobCandidatesResponse>(path, { token });
};

export const recomputeMatches = (jobId: string, token?: string, payload?: { limit?: number }) => {
  return apiRequest(`/hr/jobs/${jobId}/recompute-matches`, {
    method: 'POST',
    token,
    body: payload ? JSON.stringify(payload) : undefined
  });
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


