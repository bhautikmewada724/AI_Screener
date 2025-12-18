import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';

import {
  createComment,
  fetchAuditTrail,
  fetchComments,
  fetchJobById,
  fetchReviewQueue,
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
  EvidenceSnippet
} from '../types/api';
import { fetchJobMatches } from '../api/matching';
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

const JobDetailPage = () => {
  const { jobId = '' } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRecord | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [scoringForm, setScoringForm] = useState<ScoringConfig | null>(null);
  const [scoringMessage, setScoringMessage] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJobById(jobId, token),
    enabled: Boolean(jobId && token)
  });

  const queueQuery = useQuery({
    queryKey: ['review-queue', jobId, statusFilter],
    queryFn: () => fetchReviewQueue({ jobId, status: statusFilter }, token),
    enabled: Boolean(jobId && token)
  });

  const scoringConfigQuery = useQuery<{ scoringConfig: ScoringConfig }>({
    queryKey: ['scoring-config', jobId],
    queryFn: () => fetchScoringConfig(jobId, token),
    enabled: Boolean(jobId && token)
  });

  const applications = queueQuery.data?.data ?? [];

  useEffect(() => {
    if (scoringConfigQuery.data?.scoringConfig) {
      setScoringForm(scoringConfigQuery.data.scoringConfig);
    }
  }, [scoringConfigQuery.data]);

  useEffect(() => {
    if (!selectedApplication && applications.length) {
      setSelectedApplication(applications[0]);
    }
  }, [applications, selectedApplication]);

  const commentsQuery = useQuery({
    queryKey: ['comments', selectedApplication?._id],
    queryFn: () => fetchComments(selectedApplication!._id, token),
    enabled: Boolean(selectedApplication?._id && token)
  });

  const auditQuery = useQuery({
    queryKey: ['audit', selectedApplication?._id],
    queryFn: () => fetchAuditTrail(selectedApplication!._id, token),
    enabled: Boolean(selectedApplication?._id && token)
  });

  const aiMatchesQuery = useQuery({
    queryKey: ['ai-matches', jobId],
    queryFn: () => fetchJobMatches(jobId, token, { limit: 10 }),
    enabled: Boolean(jobId && token)
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { applicationId: string; status: string; reviewStage?: string; decisionReason?: string }) =>
      updateApplicationStatus(payload.applicationId, payload, token),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['audit', variables.applicationId] });
      setStatusError(null);
    },
    onError: (error: Error) => {
      setStatusError(error.message || 'Failed to update status.');
    }
  });

  const scoreMutation = useMutation({
    mutationFn: (applicationId: string) => refreshApplicationScore(applicationId, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-queue'] })
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

  const commentMutation = useMutation({
    mutationFn: (payload: { applicationId: string; body: string; visibility?: 'shared' | 'private' }) =>
      createComment(payload.applicationId, { body: payload.body, visibility: payload.visibility }, token),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.applicationId] });
    }
  });

  const selectedResume = selectedApplication?.resumeId;
  const job = jobQuery.data;

  const pageTitle = job ? `${job.title} · ${job.location ?? 'Remote'}` : 'Loading job…';

  const handleStatusChange = (status: string, application?: ApplicationRecord) => {
    const target = application ?? selectedApplication;
    if (!target) return;
    const allowed = ALLOWED_TRANSITIONS[target.status as keyof typeof ALLOWED_TRANSITIONS] || [];
    if (!allowed.includes(status as any)) {
      setStatusError(`Cannot move from ${target.status.replace('_', ' ')} to ${status.replace('_', ' ')}.`);
      return;
    }
    setSelectedApplication(target);
    statusMutation.mutate({ applicationId: target._id, status });
  };

  const handleCommentSubmit = async (body: string, visibility: 'shared' | 'private') => {
    if (!selectedApplication) return;
    await commentMutation.mutateAsync({ applicationId: selectedApplication._id, body, visibility });
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
    const raw = (selectedApplication?.matchExplanation || {}) as ExplainabilityPayload | Record<string, any>;
    const breakdown: ScoreBreakdown | undefined =
      selectedApplication?.scoreBreakdown ||
      (raw && typeof raw === 'object' && (raw as any).score_breakdown) ||
      undefined;
    return {
      matchedSkills: raw?.matched_skills || selectedApplication?.matchedSkills || [],
      missingMust: raw?.missing_must_have_skills || [],
      missingNice: raw?.missing_nice_to_have_skills || [],
      evidence: raw?.evidence || [],
      scoreBreakdown: breakdown,
      scoringConfigVersion: selectedApplication?.scoringConfigVersion
    };
  }, [selectedApplication]);

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
              'rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
              statusFilter === chip.status ? 'bg-brand-navy text-white' : 'border-slate-200 text-brand-navy'
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
                <h2 className="text-xl font-semibold text-brand-navy">AI Ranked Candidates</h2>
                <p className="text-sm text-brand-ash">Top matches generated by the explainable scoring engine.</p>
              </div>
              <button
                type="button"
                className="btn bg-sky-50 text-brand-navy hover:bg-sky-100"
                onClick={() => aiMatchesQuery.refetch()}
                disabled={aiMatchesQuery.isFetching}
              >
                Refresh
              </button>
            </div>
            {aiMatchesQuery.isLoading && <p className="text-sm text-brand-ash">Loading AI matches…</p>}
            {aiMatchesQuery.isError && (
              <p className="text-sm text-rose-600">
                {aiMatchesQuery.error instanceof ApiError && aiMatchesQuery.error.status >= 500
                  ? 'AI matching is temporarily unavailable. You can still review candidates manually.'
                  : `Failed to load AI matches: ${(aiMatchesQuery.error as Error).message}`}
              </p>
            )}
            {aiMatchesQuery.data?.data?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {aiMatchesQuery.data.data.map((match) => {
                  const explanation = (typeof match.explanation === 'string'
                    ? { notes: match.explanation }
                    : (match.explanation as MatchExplanation)) || {};
                  const missingSkills = Array.isArray(explanation.missingSkills) ? explanation.missingSkills : [];
                  const matchedTags = Array.isArray(explanation.matchedTags) ? explanation.matchedTags : [];
                  const hasAdditionalDetail =
                    missingSkills.length > 0 ||
                    typeof explanation.experienceYears === 'number' ||
                    Boolean(explanation.locationMatch) ||
                    matchedTags.length > 0 ||
                    Boolean(explanation.notes);

                  return (
                    <article key={match.matchId} className="rounded-2xl bg-brand-navy p-5 text-white shadow-card-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-lg font-semibold leading-tight">{getCandidateLabel(match)}</div>
                          <p className="text-sm text-white/75">{match.resumeSummary || 'No summary available'}</p>
                    </div>
                    <div className="text-right">
                          <div className="text-3xl font-bold leading-none">{Math.round(match.matchScore * 100)}%</div>
                          <small className="text-xs uppercase tracking-wide text-white/70">AI Match Score</small>
                    </div>
                  </div>
                      <div className="mt-4">
                        <small className="text-xs uppercase tracking-wide text-white/60">Matched skills</small>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(match.matchedSkills || []).slice(0, 6).map((skill) => (
                            <span key={skill} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                          {skill}
                        </span>
                      ))}
                      {(!match.matchedSkills || !match.matchedSkills.length) && (
                            <span className="text-sm text-white/70">No skill overlap yet.</span>
                      )}
                    </div>
                  </div>
                  {match.explanation && (
                        <details className="mt-4 rounded-2xl bg-white/5 p-4 text-sm">
                          <summary className="cursor-pointer font-semibold text-white">Explainability details</summary>
                          <div className="mt-3 space-y-2 text-white/80">
                            {missingSkills.length > 0 && (
                              <p className="m-0">
                                <strong>Missing skills:</strong> {missingSkills.join(', ')}
                              </p>
                            )}
                            {typeof explanation.experienceYears === 'number' && (
                              <p className="m-0">
                                <strong>Experience:</strong> {explanation.experienceYears.toFixed(1)} yrs
                              </p>
                            )}
                            {explanation.locationMatch && (
                              <p className="m-0">
                                <strong>Location match:</strong> {explanation.locationMatch}
                              </p>
                            )}
                            {matchedTags.length > 0 && (
                              <p className="m-0">
                                <strong>Tag overlap:</strong> {matchedTags.join(', ')}
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
                    </article>
                  );
                })}
              </div>
            ) : (
              !aiMatchesQuery.isLoading && <p className="text-sm text-brand-ash">No AI matches available yet.</p>
            )}
          </section>

          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <strong>Candidate Review Queue</strong>
              {queueQuery.isLoading && <small className="text-brand-ash">Loading…</small>}
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
                        className={clsx(selectedApplication?._id === application._id && 'bg-slate-50')}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedApplication(application)}
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
                    selectedApplication?._id === application._id && 'ring-2 ring-brand-navy/40'
                  )}
                  onClick={() => setSelectedApplication(application)}
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
            {!queueQuery.isLoading && applications.length === 0 && (
              <p className="text-sm text-brand-ash">No applications match this filter yet.</p>
            )}
          </section>
        </div>

        <section className="card space-y-4">
          <div>
            <strong>Candidate Snapshot</strong>
            {selectedApplication && (
              <div className="mt-2 text-sm text-brand-ash">
                Applied {new Date(selectedApplication.createdAt).toLocaleDateString()} ·{' '}
                <span className={`status-badge ${selectedApplication.status}`}>
                  {selectedApplication.status.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>

          {selectedResume ? (
            <ResumeViewer
              resume={selectedResume}
              matchScore={selectedApplication?.matchScore}
              highlightedSkills={selectedApplication?.matchedSkills}
            />
          ) : (
            <p className="text-sm text-brand-ash">Select a candidate to preview their resume insights.</p>
          )}

          {selectedApplication && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <strong className="text-brand-navy">Explainability</strong>
                <small className="text-brand-ash">
                  Config v{explainabilityData.scoringConfigVersion ?? 'N/A'}
                </small>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-brand-navy">
                <div>
                  <span className="font-semibold">Matched skills:</span>{' '}
                  {explainabilityData.matchedSkills?.length
                    ? explainabilityData.matchedSkills.join(', ')
                    : 'None'}
                </div>
                {explainabilityData.missingMust?.length ? (
                  <div className="text-rose-600">
                    <span className="font-semibold">Missing must-have:</span>{' '}
                    {explainabilityData.missingMust.join(', ')}
                  </div>
                ) : null}
                {explainabilityData.missingNice?.length ? (
                  <div className="text-brand-ash">
                    <span className="font-semibold">Missing nice-to-have:</span>{' '}
                    {explainabilityData.missingNice.join(', ')}
                  </div>
                ) : null}
                {explainabilityData.scoreBreakdown && (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {Object.entries(explainabilityData.scoreBreakdown)
                      .filter(([key]) => key.endsWith('_score') || key === 'final_score')
                      .map(([key, value]) => (
                        <div key={key} className="rounded-xl bg-slate-100 px-3 py-2 text-xs">
                          <div className="font-semibold uppercase tracking-wide text-brand-ash">{key.replace('_', ' ')}</div>
                          <div className="text-brand-navy">{value as number}%</div>
                        </div>
                      ))}
                  </div>
                )}
                {explainabilityData.evidence?.length ? (
                  <div className="space-y-2">
                    <div className="font-semibold text-brand-navy">Evidence</div>
                    {explainabilityData.evidence.slice(0, 3).map((item: EvidenceSnippet, idx: number) => (
                      <div key={`${item.label}-${idx}`} className="rounded-xl bg-slate-50 p-2">
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
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {STATUS_OPTIONS.map((status) => (
              <button
                type="button"
                key={status}
                className={clsx(
                  'btn text-xs font-semibold uppercase tracking-wide',
                  selectedApplication?.status === status ? 'bg-brand-navy text-white' : 'bg-slate-100 text-brand-navy'
                )}
                onClick={() => handleStatusChange(status)}
                disabled={
                  !selectedApplication ||
                  !ALLOWED_TRANSITIONS[selectedApplication.status as keyof typeof ALLOWED_TRANSITIONS]?.includes(status)
                }
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          {statusError && <p className="text-sm text-rose-600">{statusError}</p>}
        </section>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <CommentPanel notes={currentComments} loading={commentsQuery.isLoading} onSubmit={handleCommentSubmit} />
        <AuditTimeline events={auditEvents} loading={auditQuery.isLoading} />
      </section>

      {(statusMutation.isPending || scoreMutation.isPending || commentMutation.isPending) && (
        <div className="text-center text-brand-ash">Saving updates…</div>
      )}
    </div>
  );
};

export default JobDetailPage;
