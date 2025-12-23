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

export interface ParsedResumeData {
  summary?: string;
  skills?: string[];
  experience?: ResumeExperience[];
  education?: Array<{ institution?: string; degree?: string; year?: number }>;
  location?: string;
  warnings?: string[];
  embeddings?: number[];
  error?: string;
  totalYearsExperience?: number;
}

export interface ResumePayload {
  _id: string;
  status: string;
  originalFileName?: string;
  createdAt?: string;
  parsedData?: ParsedResumeData;
  parsedDataCorrected?: ParsedResumeData;
  isCorrected?: boolean;
  correctedAt?: string;
}

export interface CandidateProfile {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type ApplicationSource = 'candidate_applied' | 'hr_sourced';

export interface ApplicationRecord {
  _id: string;
  jobId: string | JobDescription;
  candidateId: CandidateProfile;
  resumeId: ResumePayload;
  status: 'applied' | 'in_review' | 'shortlisted' | 'rejected' | 'hired';
  reviewStage?: string;
  source?: ApplicationSource;
  matchScore: number;
  matchedSkills: string[];
  matchExplanation?: MatchExplanation | ExplainabilityPayload | string | null;
  missingSkills?: string[];
  embeddingSimilarity?: number;
  scoringConfigVersion?: number;
  scoreBreakdown?: ScoreBreakdown | null;
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

export interface ScoringWeights {
  skills: number;
  experience: number;
  education: number;
  keywords: number;
}

export interface ScoringConstraints {
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  minYearsExperience: number | null;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  constraints: ScoringConstraints;
  version?: number;
}

export interface ScoreBreakdown {
  skills_score?: number;
  experience_score?: number;
  education_score?: number;
  keywords_score?: number;
  embeddings_score?: number;
  location_score?: number;
  final_score?: number;
  weights?: Record<string, number>;
}

export interface EvidenceSnippet {
  type: 'resume' | 'jd';
  label: string;
  snippet: string;
  confidence?: number;
}

export interface ExplainabilityPayload {
  matched_skills?: string[];
  missing_must_have_skills?: string[];
  missing_nice_to_have_skills?: string[];
  evidence?: EvidenceSnippet[];
  score_breakdown?: ScoreBreakdown;
  model_metadata?: Record<string, string>;
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

export interface UserAuditEvent {
  id: string;
  actorId?: string;
  targetUserId?: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  context?: Record<string, unknown>;
  createdAt?: string;
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

export interface SuggestedCandidate {
  matchId: string;
  resumeId: string;
  candidateId: string;
  matchScore: number;
  matchedSkills: string[];
  explanation?: MatchExplanation | Record<string, unknown> | string;
  missingSkills?: string[];
  embeddingSimilarity?: number;
  scoreBreakdown?: ScoreBreakdown | null;
  scoringConfigVersion?: number;
  resumeSummary?: string;
  resumeSkills?: string[];
  applied?: boolean;
}

export interface JobCandidatesResponse {
  jobId: string;
  config: {
    version: number;
    source?: string;
  };
  applied: ApplicationRecord[];
  suggested: SuggestedCandidate[];
}


