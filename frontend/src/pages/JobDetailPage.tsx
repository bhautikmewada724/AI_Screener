import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';

import {
  createComment,
  addCandidateToJob,
  fetchJobApplications,
  fetchAuditTrail,
  fetchComments,
  fetchJobById,
  fetchJobSuggestions,
  fetchScoringConfig,
  refreshApplicationScore,
  updateApplicationStatus,
  updateScoringConfig
} from '../api/hr';
import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type {
  ApplicationRecord,
  ScoringConfig,
  ScoreBreakdown,
  ExplainabilityPayload,
  EvidenceSnippet,
  SuggestedCandidate,
  ResumePayload
} from '../types/api';
import ResumeViewer from '../components/ResumeViewer';
import CommentPanel from '../components/CommentPanel';
import AuditTimeline from '../components/AuditTimeline';
import PageHeader from '../components/ui/PageHeader';

const STATUS_OPTIONS = ['applied', 'in_review', 'shortlisted', 'rejected', 'hired'] as const;
const ALLOWED_TRANSITIONS: Record<(typeof STATUS_OPTIONS)[number], Array<(typeof STATUS_OPTIONS)[number]>> = {
  applied: ['in_review', 'rejected'],
  in_review: ['shortlisted', 'rejected'],
  shortlisted: ['hired', 'rejected'],
  hired: [],
  rejected: []
};

type MatchExplanation = {
  missingSkills?: string[];
  matchedTags?: string[];
  experienceYears?: number;
  locationMatch?: string;
  notes?: string;
};

type ApplicantItem = {
  kind: 'applicant';
  application: ApplicationRecord;
};

type SuggestedItem = {
  kind: 'suggested';
  suggestion: SuggestedCandidate;
};

type DetailItem = ApplicantItem | SuggestedItem;

type ExplainabilityData = {
  matchedSkills: string[];
  missingMust: string[];
  missingNice: string[];
  evidence: EvidenceSnippet[];
  scoreBreakdown?: ScoreBreakdown;
  scoringConfigVersion?: number;
};

const ExplainabilitySection = ({ data }: { data: ExplainabilityData }) => {
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <strong className="text-brand-navy">Explainability</strong>
        <small className="text-brand-ash">Config v{data.scoringConfigVersion ?? 'N/A'}</small>
      </div>
      <div className="mt-3 grid gap-3 text-sm text-brand-navy">
        <div>
          <span className="font-semibold">Matched skills:</span>{' '}
          {data.matchedSkills?.length ? data.matchedSkills.join(', ') : 'None'}
        </div>
        {data.missingMust?.length ? (
          <div className="text-rose-600">
            <span className="font-semibold">Missing must-have:</span> {data.missingMust.join(', ')}
          </div>
        ) : null}
        {data.missingNice?.length ? (
          <div className="text-brand-ash">
            <span className="font-semibold">Missing nice-to-have:</span> {data.missingNice.join(', ')}
          </div>
        ) : null}
        {data.scoreBreakdown && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {Object.entries(data.scoreBreakdown)
              .filter(([key]) => key.endsWith('_score') || key === 'final_score')
              .map(([key, value]) => (
                <div key={key} className="rounded-xl bg-white px-3 py-2 text-xs">
                  <div className="font-semibold uppercase tracking-wide text-brand-ash">{key.replace('_', ' ')}</div>
                  <div className="text-brand-navy">{value as number}%</div>
                </div>
              ))}
          </div>
        )}
        {data.evidence?.length ? (
          <div className="space-y-2">
            <div className="font-semibold text-brand-navy">Evidence</div>
            {data.evidence.slice(0, 3).map((item: EvidenceSnippet, idx: number) => (
              <div key={`${item.label}-${idx}`} className="rounded-xl bg-white p-2 shadow-card-sm">
                <div className="flex items-center justify-between text-xs text-brand-ash">
                  <span>{item.type}</span>
                  {typeof item.confidence === 'number' && <span>Conf: {Math.round(item.confidence * 100)}%</span>}
                </div>
                <div className="text-sm font-semibold text-brand-navy">{item.label}</div>
                <div className="text-sm text-brand-ash">{item.snippet}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

type ApplicantDetailsPanelProps = {
  application: ApplicationRecord;
  resume?: ResumePayload;
  explainabilityData: ExplainabilityData;
  onStatusChange: (status: (typeof STATUS_OPTIONS)[number]) => void;
  statusError: string | null;
};

const ApplicantDetailsPanel = ({
  application,
  resume,
  explainabilityData,
  onStatusChange,
  statusError
}: ApplicantDetailsPanelProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Applicant</p>
            <h3 className="text-xl font-semibold text-brand-navy">{application.candidateId.name}</h3>
            <p className="text-sm text-brand-ash">{application.candidateId.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`status-badge ${application.status}`}>{application.status.replace('_', ' ')}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Applied on {new Date(application.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold leading-none text-brand-navy">
              {Math.round((application.matchScore ?? 0) * 100)}%
            </div>
            <small className="text-xs uppercase tracking-wide text-brand-ash">AI match score</small>
          </div>
        </div>
      </div>

      {resume ? (
        <ResumeViewer resume={resume} matchScore={application.matchScore} highlightedSkills={application.matchedSkills} />
      ) : (
        <p className="text-sm text-brand-ash">No resume available for this applicant.</p>
      )}

      <ExplainabilitySection data={explainabilityData} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <strong className="text-sm text-brand-navy">Stage actions</strong>
          <small className="text-brand-ash">Move applicants through the pipeline.</small>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {STATUS_OPTIONS.map((status) => (
            <button
              type="button"
              key={status}
              className={clsx(
                'btn text-xs font-semibold uppercase tracking-wide',
                application.status === status
                  ? 'bg-indigo-600 text-white shadow-card-sm'
                  : 'bg-white text-brand-navy ring-1 ring-slate-200 hover:bg-indigo-50'
              )}
              onClick={() => onStatusChange(status)}
              disabled={
                !ALLOWED_TRANSITIONS[application.status as keyof typeof ALLOWED_TRANSITIONS]?.includes(status) ||
                application.status === status
              }
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
        {statusError && <p className="text-sm text-rose-600">{statusError}</p>}
      </div>
    </div>
  );
};

type SuggestedDetailsPanelProps = {
  suggestion: SuggestedCandidate;
  label: string;
  explainabilityData: ExplainabilityData;
  onAddToJob: () => void;
  isAdding: boolean;
};

const SuggestedDetailsPanel = ({
  suggestion,
  label,
  explainabilityData,
  onAddToJob,
  isAdding
}: SuggestedDetailsPanelProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Suggested Candidate — Not Applied</p>
            <h3 className="text-xl font-semibold text-brand-navy">{label}</h3>
            <p className="text-sm text-brand-ash">{suggestion.resumeSummary || 'No summary available yet.'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Not Applied
              </span>
              <small className="text-xs text-brand-ash">Add to job to move through stages.</small>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold leading-none text-brand-navy">{Math.round(suggestion.matchScore * 100)}%</div>
            <small className="text-xs uppercase tracking-wide text-brand-ash">AI match score</small>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card-sm">
        <strong className="text-sm text-brand-navy">Matched skills</strong>
        <div className="mt-2 flex flex-wrap gap-2">
          {(suggestion.matchedSkills || []).slice(0, 8).map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-brand-navy"
            >
              {skill}
            </span>
          ))}
          {(!suggestion.matchedSkills || !suggestion.matchedSkills.length) && (
            <span className="text-sm text-brand-ash">No overlapping skills detected yet.</span>
          )}
        </div>
      </div>

      <ExplainabilitySection data={explainabilityData} />

      <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-brand-navy">Create an application to move this candidate through stages.</div>
          <button
            type="button"
            className="btn bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={onAddToJob}
            disabled={isAdding}
          >
            {isAdding ? 'Adding…' : 'Add to Job'}
          </button>
        </div>
        <small className="text-xs text-brand-ash">Suggested candidates do not affect pipeline counts until added.</small>
      </div>
    </div>
  );
};

const JobDetailPage = () => {
  const { jobId = '' } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<DetailItem | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [scoringForm, setScoringForm] = useState<ScoringConfig | null>(null);
  const [scoringMessage, setScoringMessage] = useState<string | null>(null);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJobById(jobId, token),
    enabled: Boolean(jobId && token)
  });

  const applicationsQuery = useQuery({
    queryKey: ['job-applications', jobId, statusFilter],
    queryFn: () => fetchJobApplications({ jobId, status: statusFilter || undefined, limit: 100 }, token),
    enabled: Boolean(jobId && token)
  });

  const scoringConfigQuery = useQuery<{ scoringConfig: ScoringConfig }>({
    queryKey: ['scoring-config', jobId],
    queryFn: () => fetchScoringConfig(jobId, token),
    enabled: Boolean(jobId && token)
  });

  const suggestionsQuery = useQuery({
    queryKey: ['job-suggestions', jobId],
    queryFn: () => fetchJobSuggestions(jobId, token, { limit: 10 }),
    enabled: Boolean(jobId && token)
  });

  const applications = applicationsQuery.data?.data ?? [];
  const suggestions = suggestionsQuery.data?.data ?? [];
  const selectedApplication = selectedItem?.kind === 'applicant' ? selectedItem.application : null;
  const selectedSuggestion = selectedItem?.kind === 'suggested' ? selectedItem.suggestion : null;
  const job = jobQuery.data;

  const candidateApplicationsOpen = job?.status === 'open';
  const jobFullyClosed = job?.status === 'closed' || job?.status === 'archived';
  const hrSourcingAllowed = !jobFullyClosed;
  const candidateApplicationMessage = !job
    ? null
    : candidateApplicationsOpen
    ? 'Candidates can apply directly. You can also add matches from the resume pool.'
    : hrSourcingAllowed
    ? 'Applications are closed for candidates. You can still add candidates manually from the resume pool.'
    : 'This job is closed. Adding candidates is disabled.';

  useEffect(() => {
    if (scoringConfigQuery.data?.scoringConfig) {
      setScoringForm(scoringConfigQuery.data.scoringConfig);
    }
  }, [scoringConfigQuery.data]);

  useEffect(() => {
    const applicantItems: ApplicantItem[] = applications.map((application) => ({
      kind: 'applicant',
      application
    }));
    const suggestionItems: SuggestedItem[] = suggestions.map((suggestion) => ({
      kind: 'suggested',
      suggestion
    }));

    if (!selectedItem) {
      if (applicantItems.length) {
        setSelectedItem(applicantItems[0]);
      } else if (suggestionItems.length) {
        setSelectedItem(suggestionItems[0]);
      }
      return;
    }

    if (selectedItem.kind === 'applicant') {
      const updated = applicantItems.find((item) => item.application._id === selectedItem.application._id);
      if (updated) {
        setSelectedItem(updated);
      } else if (applicantItems.length) {
        setSelectedItem(applicantItems[0]);
      } else if (suggestionItems.length) {
        setSelectedItem(suggestionItems[0]);
      } else {
        setSelectedItem(null);
      }
    } else {
      const updated = suggestionItems.find((item) => item.suggestion.matchId === selectedItem.suggestion.matchId);
      if (updated) {
        setSelectedItem(updated);
      } else if (applicantItems.length) {
        setSelectedItem(applicantItems[0]);
      } else if (suggestionItems.length) {
        setSelectedItem(suggestionItems[0]);
      } else {
        setSelectedItem(null);
      }
    }
  }, [applications, suggestions, selectedItem]);

  const commentsQuery = useQuery({
    queryKey: ['comments', selectedItem?.kind === 'applicant' ? selectedItem.application._id : undefined],
    queryFn: () => fetchComments((selectedItem as ApplicantItem).application._id, token),
    enabled: Boolean(selectedItem?.kind === 'applicant' && token)
  });

  const auditQuery = useQuery({
    queryKey: ['audit', selectedItem?.kind === 'applicant' ? selectedItem.application._id : undefined],
    queryFn: () => fetchAuditTrail((selectedItem as ApplicantItem).application._id, token),
    enabled: Boolean(selectedItem?.kind === 'applicant' && token)
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { applicationId: string; status: string; reviewStage?: string; decisionReason?: string }) =>
      updateApplicationStatus(payload.applicationId, payload, token),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      queryClient.invalidateQueries({ queryKey: ['audit', variables.applicationId] });
      setStatusError(null);
    },
    onError: (error: Error) => {
      setStatusError(error.message || 'Failed to update status.');
    }
  });

  const scoreMutation = useMutation({
    mutationFn: (applicationId: string) => refreshApplicationScore(applicationId, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-applications'] })
  });

  const scoringConfigMutation = useMutation({
    mutationFn: (payload: ScoringConfig) => updateScoringConfig(jobId, payload, token),
    onSuccess: (data: { scoringConfig: ScoringConfig }) => {
      setScoringForm(data.scoringConfig);
      setScoringMessage('Scoring config updated.');
      queryClient.invalidateQueries({ queryKey: ['scoring-config', jobId] });
    },
    onError: (error: Error) => {
      setScoringMessage(error.message || 'Failed to update scoring config.');
    }
  });

  const addCandidateMutation = useMutation({
    mutationFn: (payload: { candidateId: string; resumeId: string }) => addCandidateToJob(jobId, payload, token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      queryClient.invalidateQueries({ queryKey: ['job-suggestions'] });
      if (data?.application) {
        setSelectedItem({ kind: 'applicant', application: data.application });
      }
      setSuggestionMessage('Candidate added to job.');
    },
    onError: (error: Error) => {
      setSuggestionMessage(error.message || 'Failed to add candidate.');
    }
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { applicationId: string; body: string; visibility?: 'shared' | 'private' }) =>
      createComment(payload.applicationId, { body: payload.body, visibility: payload.visibility }, token),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.applicationId] });
    }
  });

  const selectedResume =
    selectedItem?.kind === 'applicant' ? selectedItem.application.resumeId : undefined;
  const pageTitle = job ? `${job.title} · ${job.location ?? 'Remote'}` : 'Loading job…';

  const handleStatusChange = (status: string, application?: ApplicationRecord) => {
    const target = application ?? (selectedItem?.kind === 'applicant' ? selectedItem.application : null);
    if (!target) return;
    const allowed = ALLOWED_TRANSITIONS[target.status as keyof typeof ALLOWED_TRANSITIONS] || [];
    if (!allowed.includes(status as any)) {
      setStatusError(`Cannot move from ${target.status.replace('_', ' ')} to ${status.replace('_', ' ')}.`);
      return;
    }
    statusMutation.mutate({ applicationId: target._id, status });
  };

  const handleCommentSubmit = async (body: string, visibility: 'shared' | 'private') => {
    if (selectedItem?.kind !== 'applicant') return;
    await commentMutation.mutateAsync({ applicationId: selectedItem.application._id, body, visibility });
  };

  const currentComments = commentsQuery.data?.data ?? [];
  const auditEvents = auditQuery.data?.data ?? [];

  const candidateNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    applications.forEach((application) => {
      const candidate = application.candidateId;
      if (candidate?._id) {
        lookup.set(candidate._id, candidate.name);
      }
    });
    return lookup;
  }, [applications]);

  const getCandidateLabel = (match: { candidateId: string; resumeSummary?: string }) => {
    const knownName = candidateNameLookup.get(match.candidateId);
    if (knownName) return knownName;

    const summary = match.resumeSummary || '';
    const parenMatch = summary.match(/^\s*\(([^)]+)\)/);
    if (parenMatch?.[1]) return parenMatch[1];

    const emailMatch = summary.match(/([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (emailMatch?.[1]) return emailMatch[1];

    return `Candidate ${match.candidateId}`;
  };

  const stageChips = useMemo(
    () =>
      STATUS_OPTIONS.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status).length
      })),
    [applications]
  );

  const weightSum = useMemo(() => {
    if (!scoringForm) return 0;
    const { skills, experience, education, keywords } = scoringForm.weights;
    return [skills, experience, education, keywords].reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [scoringForm]);

  const weightsValid = Math.round(weightSum) === 100;

  const updateWeight = (key: keyof ScoringConfig['weights'], value: number) => {
    if (!scoringForm) return;
    setScoringForm({
      ...scoringForm,
      weights: { ...scoringForm.weights, [key]: value }
    });
  };

  const updateConstraints = (key: keyof ScoringConfig['constraints'], value: any) => {
    if (!scoringForm) return;
    setScoringForm({
      ...scoringForm,
      constraints: { ...scoringForm.constraints, [key]: value }
    });
  };

  const explainabilityData = useMemo(() => {
    const raw = (selectedApplication?.matchExplanation ||
      selectedSuggestion?.explanation ||
      {}) as ExplainabilityPayload | Record<string, any>;
    const breakdown: ScoreBreakdown | undefined =
      selectedApplication?.scoreBreakdown ||
      (raw && typeof raw === 'object' && (raw as any).score_breakdown) ||
      undefined;
    const matchedSkills =
      raw && typeof raw === 'object' && Array.isArray((raw as any).matched_skills)
        ? (raw as any).matched_skills
        : selectedApplication?.matchedSkills || selectedSuggestion?.matchedSkills || [];
    const missingMust =
      raw && typeof raw === 'object' && Array.isArray((raw as any).missing_must_have_skills)
        ? (raw as any).missing_must_have_skills
        : [];
    const missingNice =
      raw && typeof raw === 'object' && Array.isArray((raw as any).missing_nice_to_have_skills)
        ? (raw as any).missing_nice_to_have_skills
        : [];
    const evidence =
      (raw && typeof raw === 'object' && Array.isArray((raw as any).evidence) ? (raw as any).evidence : []) as EvidenceSnippet[];
    return {
      matchedSkills,
      missingMust,
      missingNice,
      evidence,
      scoreBreakdown: breakdown,
      scoringConfigVersion: selectedApplication?.scoringConfigVersion || selectedSuggestion?.scoringConfigVersion
    };
  }, [selectedApplication, selectedSuggestion]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle="Manage the candidate pipeline, run AI scoring previews, and collaborate with reviewers."
      />

      <section className="card space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">Scoring Configuration</h2>
            <p className="text-sm text-brand-ash">Adjust weights and constraints per job. Weights must sum to 100.</p>
          </div>
          <div className="text-sm text-brand-ash">
            Version {scoringForm?.version ?? scoringConfigQuery.data?.scoringConfig.version ?? 0}
          </div>
        </div>
        {scoringConfigQuery.isLoading && <p className="text-sm text-brand-ash">Loading scoring config…</p>}
        {scoringConfigQuery.isError && (
          <p className="text-sm text-rose-600">Failed to load scoring config. Try refreshing.</p>
        )}
        {scoringForm && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {(['skills', 'experience', 'education', 'keywords'] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-1 text-sm text-brand-navy">
                    <span className="font-semibold capitalize">{key}</span>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      max={100}
                      value={scoringForm.weights[key]}
                      onChange={(e) => updateWeight(key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
              <div className="text-sm text-brand-ash">
                Weight sum: <strong>{Math.round(weightSum)}</strong> {weightsValid ? '(valid)' : '(must equal 100)'}
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm text-brand-navy">
                <span className="font-semibold">Must-have skills (comma separated)</span>
                <input
                  type="text"
                  className="input"
                  value={scoringForm.constraints.mustHaveSkills.join(', ')}
                  onChange={(e) =>
                    updateConstraints(
                      'mustHaveSkills',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-brand-navy">
                <span className="font-semibold">Nice-to-have skills (comma separated)</span>
                <input
                  type="text"
                  className="input"
                  value={scoringForm.constraints.niceToHaveSkills.join(', ')}
                  onChange={(e) =>
                    updateConstraints(
                      'niceToHaveSkills',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-brand-navy">
                <span className="font-semibold">Min years experience</span>
                <input
                  type="number"
                  className="input"
                  min={0}
                  value={scoringForm.constraints.minYearsExperience ?? ''}
                  onChange={(e) =>
                    updateConstraints(
                      'minYearsExperience',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
              </label>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!scoringForm || !weightsValid || scoringConfigMutation.isPending}
            onClick={() => scoringForm && scoringConfigMutation.mutate(scoringForm)}
          >
            {scoringConfigMutation.isPending ? 'Saving…' : 'Save config'}
          </button>
          {scoringMessage && <span className="text-sm text-brand-ash">{scoringMessage}</span>}
          {!weightsValid && <span className="text-sm text-rose-600">Weights must sum to 100.</span>}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {stageChips.map((chip) => (
          <button
            type="button"
            key={chip.status}
            className={clsx(
              'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors shadow-sm',
              statusFilter === chip.status
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-indigo-100'
                : 'border-slate-200 bg-white text-brand-navy hover:border-indigo-200 hover:bg-indigo-50'
            )}
            onClick={() => setStatusFilter((prev) => (prev === chip.status ? '' : chip.status))}
          >
            {chip.status.replace('_', ' ')} · {chip.count}
          </button>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="card space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-brand-navy">Suggested Candidates (Not Applied)</h2>
                <p className="text-sm text-brand-ash">
                  Top matches from the resume pool. Add to job to create an application before moving stages.
                </p>
                {candidateApplicationMessage && (
                  <p className="text-xs font-medium text-slate-600">{candidateApplicationMessage}</p>
                )}
              </div>
              <button
                type="button"
                className="btn bg-sky-50 text-brand-navy hover:bg-sky-100"
                onClick={() => suggestionsQuery.refetch()}
                disabled={suggestionsQuery.isFetching}
              >
                Refresh
              </button>
            </div>
            {suggestionMessage && <p className="text-sm text-brand-ash">{suggestionMessage}</p>}
            {suggestionsQuery.isLoading && <p className="text-sm text-brand-ash">Loading suggestions…</p>}
            {suggestionsQuery.isError && (
              <p className="text-sm text-rose-600">
                {suggestionsQuery.error instanceof ApiError && suggestionsQuery.error.status >= 500
                  ? 'AI matching is temporarily unavailable. You can still review candidates manually.'
                  : `Failed to load suggestions: ${(suggestionsQuery.error as Error).message}`}
              </p>
            )}
            {suggestionsQuery.data?.data?.length ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {suggestionsQuery.data.data.map((match) => {
                  const explanation = (typeof match.explanation === 'string'
                    ? { notes: match.explanation }
                    : (match.explanation as MatchExplanation)) || {};
                  const missingSkills = Array.isArray(explanation.missingSkills) ? explanation.missingSkills : [];
                  const matchedTags = Array.isArray(explanation.matchedTags) ? explanation.matchedTags : [];
                  const matchedSkills = match.matchedSkills || [];
                  const topMatchedSkills = matchedSkills.slice(0, 4);
                  const extraMatchedCount = Math.max(matchedSkills.length - 4, 0);
                  const missingRequired = missingSkills.slice(0, 2);
                  const extraMissingCount = Math.max(missingSkills.length - 2, 0);
                  const hasAdditionalDetail =
                    missingSkills.length > 0 ||
                    typeof explanation.experienceYears === 'number' ||
                    Boolean(explanation.locationMatch) ||
                    matchedTags.length > 0 ||
                    Boolean(explanation.notes);

                  return (
                    <article
                      key={match.matchId}
                      className={clsx(
                        'h-full overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 shadow-sm transition-shadow hover:shadow-md',
                        selectedSuggestion?.matchId === match.matchId && 'ring-2 ring-indigo-200 ring-offset-1'
                      )}
                      onClick={() => setSelectedItem({ kind: 'suggested', suggestion: match })}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-lg font-semibold leading-tight text-brand-navy" title={getCandidateLabel(match)}>
                            {getCandidateLabel(match)}
                          </div>
                          <p className="line-clamp-2 text-sm text-brand-ash">{match.resumeSummary || 'No summary available'}</p>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                            Not Applied
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                            {Math.round(match.matchScore * 100)}% Match
                          </div>
                          <small className="text-xs uppercase tracking-wide text-brand-ash">AI Match</small>
                        </div>
                      </div>

                      <div className="mt-4">
                        <small className="text-xs uppercase tracking-wide text-brand-ash">Matched skills</small>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {topMatchedSkills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-brand-navy"
                            >
                              {skill}
                            </span>
                          ))}
                          {extraMatchedCount > 0 && (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-brand-navy">
                              +{extraMatchedCount}
                            </span>
                          )}
                          {(!matchedSkills.length || !topMatchedSkills.length) && (
                            <span className="text-sm text-brand-ash">Low overlap — review before adding.</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        {missingRequired.length ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-800">
                            Missing: {missingRequired.join(', ')}
                            {extraMissingCount > 0 ? ` +${extraMissingCount}` : ''}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-800">
                            Skills differ from this role — review before adding.
                          </div>
                        )}
                      </div>

                      {match.explanation && (
                        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-brand-navy">
                          <summary className="cursor-pointer text-indigo-700 hover:text-indigo-800">Why this match?</summary>
                          <div className="mt-2 space-y-2 text-brand-ash">
                            {topMatchedSkills.length > 0 && (
                              <p className="m-0">
                                <strong>Matched:</strong> {topMatchedSkills.join(', ')}
                                {extraMatchedCount > 0 ? ` +${extraMatchedCount}` : ''}
                              </p>
                            )}
                            {missingRequired.length > 0 && (
                              <p className="m-0">
                                <strong>Missing:</strong> {missingRequired.join(', ')}
                                {extraMissingCount > 0 ? ` +${extraMissingCount}` : ''}
                              </p>
                            )}
                            {typeof explanation.experienceYears === 'number' && (
                              <p className="m-0">
                                <strong>Experience:</strong> {explanation.experienceYears.toFixed(1)} yrs
                              </p>
                            )}
                            {matchedTags.length > 0 && (
                              <p className="m-0">
                                <strong>Tags:</strong> {matchedTags.join(', ')}
                              </p>
                            )}
                            {explanation.notes && (
                              <p className="m-0">
                                <strong>Notes:</strong> {explanation.notes}
                              </p>
                            )}
                            {!hasAdditionalDetail && <p className="m-0">No additional signals.</p>}
                          </div>
                        </details>
                      )}
                      <div className="mt-4 space-y-2">
                        <button
                          type="button"
                          className="btn bg-indigo-600 text-white hover:bg-indigo-700"
                          disabled={addCandidateMutation.isPending || jobFullyClosed}
                          onClick={() => addCandidateMutation.mutate({ candidateId: match.candidateId, resumeId: match.resumeId })}
                        >
                          {addCandidateMutation.isPending ? 'Adding…' : 'Add to Job'}
                        </button>
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-indigo-700 hover:text-indigo-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedItem({ kind: 'suggested', suggestion: match });
                          }}
                        >
                          Preview
                        </button>
                        <div className="flex items-center justify-between text-xs text-brand-ash">
                          <span>Adds candidate to Applicants for this job.</span>
                          {jobFullyClosed && <span className="text-rose-600">Job closed—adding disabled.</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              !suggestionsQuery.isLoading && (
                <p className="text-sm text-brand-ash">
                  No suggested candidates yet. Refresh matching or adjust the job requirements to see new recommendations.
                </p>
              )
            )}
          </section>

          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <strong className="text-brand-navy">Candidate Review Queue (Applicants)</strong>
                <p className="text-xs text-brand-ash">Only candidates who applied or were added to this job.</p>
              </div>
              {applicationsQuery.isLoading && <small className="text-brand-ash">Loading…</small>}
            </div>
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="table min-w-full">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Match</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr
                        key={application._id}
                        className={clsx(
                          selectedApplication?._id === application._id && 'bg-indigo-50/60'
                        )}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedItem({ kind: 'applicant', application })}
                      >
                        <td>
                          <div className="font-semibold text-brand-navy">{application.candidateId.name}</div>
                          <small className="text-brand-ash">{application.candidateId.email}</small>
                        </td>
                        <td>
                          <div className="font-semibold text-brand-navy">
                            {Math.round((application.matchScore ?? 0) * 100)}%
                          </div>
                          <small className="text-brand-ash">
                            {application.matchedSkills.slice(0, 3).join(', ') || 'No overlap'}
                          </small>
                        </td>
                        <td>
                          <span className={`status-badge ${application.status}`}>
                            {application.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleStatusChange('shortlisted', application);
                              }}
                              disabled={!ALLOWED_TRANSITIONS[application.status as keyof typeof ALLOWED_TRANSITIONS]?.includes('shortlisted')}
                            >
                              Shortlist
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleStatusChange('rejected', application);
                              }}
                              disabled={!ALLOWED_TRANSITIONS[application.status as keyof typeof ALLOWED_TRANSITIONS]?.includes('rejected')}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                scoreMutation.mutate(application._id);
                              }}
                            >
                              Refresh Score
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-4 lg:hidden">
              {applications.map((application) => (
                <article
                  key={application._id}
                  className={clsx(
                    'rounded-2xl border border-slate-100 p-4 shadow-card-sm',
                    selectedApplication?._id === application._id && 'ring-2 ring-indigo-200'
                  )}
                  onClick={() => setSelectedItem({ kind: 'applicant', application })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-brand-navy">{application.candidateId.name}</div>
                      <small className="text-brand-ash">{application.candidateId.email}</small>
                    </div>
                    <span className={`status-badge ${application.status}`}>
                      {application.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-brand-navy">
                    Match {Math.round((application.matchScore ?? 0) * 100)}% ·{' '}
                    {application.matchedSkills.slice(0, 3).join(', ') || 'No overlap'}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStatusChange('shortlisted', application);
                      }}
                      disabled={!ALLOWED_TRANSITIONS[application.status as keyof typeof ALLOWED_TRANSITIONS]?.includes('shortlisted')}
                    >
                      Shortlist
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStatusChange('rejected', application);
                      }}
                      disabled={!ALLOWED_TRANSITIONS[application.status as keyof typeof ALLOWED_TRANSITIONS]?.includes('rejected')}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        scoreMutation.mutate(application._id);
                      }}
                    >
                      Refresh
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!applicationsQuery.isLoading && applications.length === 0 && (
              <p className="text-sm text-brand-ash">
                No applicants yet. They will appear once someone applies or you add a suggested candidate to this job.
              </p>
            )}
          </section>
        </div>

        <section className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="text-brand-navy">Candidate Details</strong>
              <p className="text-sm text-brand-ash">
                {selectedApplication
                  ? 'Applicant record with applied date and pipeline actions.'
                  : selectedSuggestion
                  ? 'Suggested candidate — not applied. Add to job to create an application.'
                  : 'Select an applicant or suggested candidate to view details.'}
              </p>
            </div>
            {selectedApplication && (
              <span className={`status-badge ${selectedApplication.status}`}>
                {selectedApplication.status.replace('_', ' ')}
              </span>
            )}
            {selectedSuggestion && (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Not Applied
              </span>
            )}
          </div>

          {selectedApplication && (
            <ApplicantDetailsPanel
              application={selectedApplication}
              resume={selectedResume}
              explainabilityData={explainabilityData}
              onStatusChange={handleStatusChange}
              statusError={statusError}
            />
          )}

          {selectedSuggestion && (
            <SuggestedDetailsPanel
              suggestion={selectedSuggestion}
              label={getCandidateLabel({
                candidateId: selectedSuggestion.candidateId,
                resumeSummary: selectedSuggestion.resumeSummary
              })}
              explainabilityData={explainabilityData}
              onAddToJob={() =>
                addCandidateMutation.mutate({
                  candidateId: selectedSuggestion.candidateId,
                  resumeId: selectedSuggestion.resumeId
                })
              }
              isAdding={addCandidateMutation.isPending}
            />
          )}

          {!selectedItem && (
            <p className="text-sm text-brand-ash">
              Select a suggested candidate or applicant to view resume insights and actions.
            </p>
          )}
        </section>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {selectedApplication ? (
          <CommentPanel notes={currentComments} loading={commentsQuery.isLoading} onSubmit={handleCommentSubmit} />
        ) : (
          <div className="card space-y-3">
            <strong className="text-brand-navy">Comments & Collaboration</strong>
            <p className="text-sm text-brand-ash">Select an applicant to view or add review notes.</p>
          </div>
        )}
        {selectedApplication ? (
          <AuditTimeline events={auditEvents} loading={auditQuery.isLoading} />
        ) : (
          <div className="card space-y-3">
            <strong className="text-brand-navy">Audit Trail</strong>
            <p className="text-sm text-brand-ash">Audit history is available when an applicant is selected.</p>
          </div>
        )}
      </section>

      {(statusMutation.isPending || scoreMutation.isPending || commentMutation.isPending) && (
        <div className="text-center text-brand-ash">Saving updates…</div>
      )}
    </div>
  );
};

export default JobDetailPage;
