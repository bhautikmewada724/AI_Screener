import { apiRequest, withQuery } from './client';

export const fetchJobMatches = (jobId: string, token?: string, options?: { minScore?: number; limit?: number }) => {
  const path = withQuery(`/matching/jobs/${jobId}`, {
    minScore: options?.minScore,
    limit: options?.limit
  });
  return apiRequest<{ data: Array<{
    matchId: string;
    resumeId: string;
    candidateId: string;
    matchScore: number;
    matchedSkills: string[];
    missingSkills?: string[];
    embeddingSimilarity?: number;
    explanation: Record<string, unknown>;
    resumeSummary?: string;
    resumeSkills?: string[];
  }> }>(path, { token });
};


