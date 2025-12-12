import { apiRequest, withQuery } from './client';
import type { MatchExplanation } from '../types/api';

export const fetchJobMatches = (
  jobId: string,
  token?: string,
  options?: { minScore?: number; limit?: number; refresh?: boolean }
) => {
  const path = withQuery(`/matching/jobs/${jobId}`, {
    minScore: options?.minScore,
    limit: options?.limit,
    refresh: options?.refresh ? 'true' : undefined
  });
  return apiRequest<{
    data: Array<{
      matchId: string;
      resumeId: string;
      candidateId: string;
      matchScore: number;
      matchedSkills: string[];
      missingSkills?: string[];
      embeddingSimilarity?: number;
      explanation: MatchExplanation | Record<string, unknown> | string;
      resumeSummary?: string;
      resumeSkills?: string[];
    }>;
  }>(path, { token });
};


