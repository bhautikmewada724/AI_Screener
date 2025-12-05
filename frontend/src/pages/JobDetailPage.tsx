import { Fragment, useEffect, useMemo, useState } from 'react';
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
import type { ApplicationRecord, ReviewNote } from '../types/api';
import { fetchJobMatches } from '../api/matching';
import ResumeViewer from '../components/ResumeViewer';
import CommentPanel from '../components/CommentPanel';
import AuditTimeline from '../components/AuditTimeline';

const STATUS_OPTIONS = ['applied', 'in_review', 'shortlisted', 'rejected', 'hired'] as const;

const JobDetailPage = () => {
  const { jobId = '' } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('');
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

  const stageChips = useMemo(
    () =>
      STATUS_OPTIONS.map((status) => ({
        status,
        count: applications.filter((application) => application.status === status).length
      })),
    [applications]
  );

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>{pageTitle}</h1>
        <p style={{ color: '#475569', margin: 0 }}>
          Manage the candidate pipeline, run AI scoring previews, and collaborate with reviewers.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {stageChips.map((chip) => (
            <span
              key={chip.status}
              className={clsx('status-badge', chip.status)}
              style={{ cursor: 'pointer' }}
              onClick={() => setStatusFilter((prev) => (prev === chip.status ? '' : chip.status))}
            >
              {chip.status.replace('_', ' ')} · {chip.count}
            </span>
          ))}
        </div>
      </header>

      <section className="grid" style={{ gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>AI Ranked Candidates</h2>
            <p style={{ margin: 0, color: '#64748b' }}>Top matches generated by the explainable scoring engine.</p>
          </div>
          <button
            className="btn"
            style={{ background: '#e0f2fe', color: '#0f172a' }}
            onClick={() => aiMatchesQuery.refetch()}
            disabled={aiMatchesQuery.isFetching}
          >
            Refresh
          </button>
        </div>
        {aiMatchesQuery.isLoading && <p>Loading AI matches…</p>}
        {aiMatchesQuery.isError && (
          <p style={{ color: '#b91c1c' }}>Failed to load AI matches: {(aiMatchesQuery.error as Error).message}</p>
        )}
        {aiMatchesQuery.data?.data?.length ? (
          <div className="grid" style={{ marginTop: '1rem', gap: '1rem' }}>
            {aiMatchesQuery.data.data.map((match) => (
              <div key={match.matchId} className="card" style={{ background: '#0f172a', color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Candidate {match.candidateId}</strong>
                    <p style={{ margin: 0, color: '#cbd5f5' }}>{match.resumeSummary || 'No summary available'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{Math.round(match.matchScore * 100)}%</div>
                    <small>AI Match Score</small>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <small style={{ color: '#94a3b8' }}>Matched skills</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                    {(match.matchedSkills || []).slice(0, 6).map((skill) => (
                      <span key={skill} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.85rem' }}>
                        {skill}
                      </span>
                    ))}
                    {(!match.matchedSkills || !match.matchedSkills.length) && <span>No skill overlap yet.</span>}
                  </div>
                </div>
                {match.explanation && (
                  <details style={{ marginTop: '0.75rem' }}>
                    <summary style={{ cursor: 'pointer' }}>Explainability details</summary>
                    {(() => {
                      const explanation =
                        typeof match.explanation === 'string'
                          ? { notes: match.explanation }
                          : (match.explanation as Record<string, any>) || {};
                      const missingSkills = Array.isArray(explanation.missingSkills)
                        ? explanation.missingSkills
                        : [];
                      const matchedTags = Array.isArray(explanation.matchedTags)
                        ? explanation.matchedTags
                        : [];
                      return (
                        <div style={{ marginTop: '0.5rem', color: '#cbd5f5', fontSize: '0.9rem' }}>
                          {missingSkills.length > 0 && (
                            <p style={{ margin: 0 }}>
                              <strong>Missing skills:</strong> {missingSkills.join(', ')}
                            </p>
                          )}
                          {typeof explanation.experienceYears === 'number' && (
                            <p style={{ margin: 0 }}>
                              <strong>Experience:</strong> {explanation.experienceYears.toFixed(1)} yrs
                            </p>
                          )}
                          {explanation.locationMatch && (
                            <p style={{ margin: 0 }}>
                              <strong>Location match:</strong> {explanation.locationMatch}
                            </p>
                          )}
                          {matchedTags.length > 0 && (
                            <p style={{ margin: 0 }}>
                              <strong>Tag overlap:</strong> {matchedTags.join(', ')}
                            </p>
                          )}
                          {explanation.notes && (
                            <p style={{ margin: 0 }}>
                              <strong>Notes:</strong> {explanation.notes}
                            </p>
                          )}
                          {!missingSkills.length &&
                            typeof explanation.experienceYears !== 'number' &&
                            !explanation.locationMatch &&
                            !matchedTags.length &&
                            !explanation.notes && <p style={{ margin: 0 }}>No additional signals.</p>}
                        </div>
                      );
                    })()}
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          !aiMatchesQuery.isLoading && <p style={{ color: '#94a3b8' }}>No AI matches available yet.</p>
        )}
      </section>
        <div className="card" style={{ overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <strong>Candidate Review Queue</strong>
            {queueQuery.isLoading && <small>Loading…</small>}
          </div>
          <table className="table">
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
                  style={{
                    background: selectedApplication?._id === application._id ? '#f1f5f9' : undefined,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedApplication(application)}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{application.candidateId.name}</div>
                    <small style={{ color: '#64748b' }}>{application.candidateId.email}</small>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{Math.round((application.matchScore ?? 0) * 100)}%</div>
                    <small style={{ color: '#64748b' }}>
                      {application.matchedSkills.slice(0, 3).join(', ') || 'No overlap'}
                    </small>
                  </td>
                  <td>
                    <span className={`status-badge ${application.status}`}>{application.status.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        style={{ background: '#ecfccb' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStatusChange('shortlisted', application);
                        }}
                      >
                        Shortlist
                      </button>
                      <button
                        className="btn"
                        style={{ background: '#fee2e2' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStatusChange('rejected', application);
                        }}
                      >
                        Reject
                      </button>
                      <button
                        className="btn"
                        style={{ background: '#e0f2fe' }}
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
          {!queueQuery.isLoading && applications.length === 0 && (
            <p style={{ color: '#94a3b8' }}>No applications match this filter yet.</p>
          )}
        </div>

        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <strong>Candidate Snapshot</strong>
            {selectedApplication && (
              <div style={{ marginTop: '0.5rem', color: '#475569' }}>
                Applied {new Date(selectedApplication.createdAt).toLocaleDateString()} ·{' '}
                <span className={`status-badge ${selectedApplication.status}`}>{selectedApplication.status}</span>
              </div>
            )}
          </div>

          {selectedResume ? (
            <ResumeViewer resume={selectedResume} matchScore={selectedApplication?.matchScore} />
          ) : (
            <p>Select a candidate to preview their resume insights.</p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                className={clsx('btn', selectedApplication?.status === status && 'active')}
                style={{
                  background: selectedApplication?.status === status ? '#0f172a' : '#e2e8f0',
                  color: selectedApplication?.status === status ? '#fff' : '#0f172a',
                  flex: 1
                }}
                onClick={() => handleStatusChange(status)}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <CommentPanel notes={currentComments} loading={commentsQuery.isLoading} onSubmit={handleCommentSubmit} />
        <AuditTimeline events={auditEvents} loading={auditQuery.isLoading} />
      </section>

      {(statusMutation.isPending || scoreMutation.isPending || commentMutation.isPending) && (
        <div style={{ textAlign: 'center', color: '#475569' }}>Saving updates…</div>
      )}
    </div>
  );
};

export default JobDetailPage;


