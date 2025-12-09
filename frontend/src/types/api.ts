export type UserRole = 'admin' | 'hr' | 'candidate';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: 'active' | 'inactive' | 'banned';
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface JobSummary {
  _id: string;
  title: string;
  location?: string;
  requiredSkills?: string[];
  niceToHaveSkills?: string[];
  status?: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived';
  tags?: string[];
  metadata?: JobMetadata;
}

export interface JobDescription extends JobSummary {
  description: string;
  employmentType?: string;
  salaryRange?: SalaryRange;
  openings?: number;
  reviewStages?: string[];
  hrId?: string;
  createdAt: string;
}

export interface JobMetadata {
  [key: string]: string | undefined;
  seniorityLevel?: string;
  jobCategory?: string;
  aiSummary?: string;
}

export interface ResumeExperience {
  company?: string;
  role?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface ResumePayload {
  _id: string;
  status: string;
  originalFileName?: string;
  createdAt?: string;
  parsedData?: {
    summary?: string;
    skills?: string[];
    experience?: ResumeExperience[];
    education?: Array<{ institution?: string; degree?: string; year?: number }>;
    location?: string;
    warnings?: string[];
    embeddings?: number[];
    error?: string;
  };
}

export interface CandidateProfile {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ApplicationRecord {
  _id: string;
  jobId: string | JobDescription;
  candidateId: CandidateProfile;
  resumeId: ResumePayload;
  status: 'applied' | 'in_review' | 'shortlisted' | 'rejected' | 'hired';
  reviewStage?: string;
  matchScore: number;
  matchedSkills: string[];
  matchExplanation?: MatchExplanation | string | null;
  missingSkills?: string[];
  embeddingSimilarity?: number;
  decisionReason?: string;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MatchExplanation {
  notes?: string;
  missingSkills?: string[];
  embeddingSimilarity?: number;
  source?: string;
  [key: string]: unknown;
}

export interface ReviewNote {
  _id: string;
  applicationId: string;
  authorId: CandidateProfile;
  body: string;
  visibility: 'shared' | 'private';
  createdAt: string;
}

export interface AuditEventRecord {
  _id: string;
  applicationId: string;
  actorId: CandidateProfile;
  action: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface RecommendedJob {
  jobId: string;
  score: number;
  rank: number;
  reason?: string;
  status: 'shown' | 'saved' | 'dismissed' | 'applied';
  feedbackReason?: string;
  job?: JobSummary;
  jobSnapshot?: {
    title?: string;
    location?: string;
    requiredSkills?: string[];
    niceToHaveSkills?: string[];
  };
  lastRecommendedAt?: string;
}

export interface Recommendation {
  id?: string;
  candidateId?: string;
  generatedAt?: string;
  recommendedJobs: RecommendedJob[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}


