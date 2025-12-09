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
  refreshApplicationScore,
  updateApplicationStatus
} from '../api/hr';
import { useAuth } from '../hooks/useAuth';
import type { ApplicationRecord } from '../types/api';
import { fetchJobMatches } from '../api/matching';
import ResumeViewer from '../components/ResumeViewer';
import CommentPanel from '../components/CommentPanel';
import AuditTimeline from '../components/AuditTimeline';
import PageHeader from '../components/ui/PageHeader';

const STATUS_OPTIONS = ['applied', 'in_review', 'shortlisted', 'rejected', 'hired'] as const;

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

  const applications = queueQuery.data?.data ?? [];

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
    }
  });

  const scoreMutation = useMutation({
    mutationFn: (applicationId: string) => refreshApplicationScore(applicationId, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-queue'] })
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle="Manage the candidate pipeline, run AI scoring previews, and collaborate with reviewers."
      />

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
              <p className="text-sm text-rose-600">Failed to load AI matches: {(aiMatchesQuery.error as Error).message}</p>
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
                disabled={!selectedApplication}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
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
