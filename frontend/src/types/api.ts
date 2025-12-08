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

export interface JobDescription {
  _id: string;
  title: string;
  description: string;
  status: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived';
  location?: string;
  employmentType?: string;
  salaryRange?: SalaryRange;
  requiredSkills?: string[];
   niceToHaveSkills?: string[];
  openings?: number;
  tags?: string[];
  reviewStages?: string[];
  hrId?: string;
  metadata?: JobMetadata;
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
  parsedData?: {
    summary?: string;
    skills?: string[];
    experience?: ResumeExperience[];
    education?: Array<{ institution?: string; degree?: string; year?: number }>;
    location?: string;
    warnings?: string[];
    embeddings?: number[];
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
  jobId: string;
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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}


