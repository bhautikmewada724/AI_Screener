import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { applyToJob, fetchMyResumes, fetchOpenJobById, atsScanJob } from '../../api/candidate';
import { ApiError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import type { JobDescription, Recommendation, ResumePayload } from '../../types/api';
import ATSReport from '../../components/ATSReport';

const CandidateJobDetailPage = () => {
  const { jobId = '' } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<string>('');
  const [atsError, setAtsError] = useState<string | null>(null);
  const [atsReport, setAtsReport] = useState<any | null>(null);

  const jobQuery = useQuery({
    queryKey: ['public-job', jobId],
    queryFn: () => fetchOpenJobById(jobId, token),
    enabled: Boolean(jobId && token)
  });

  const resumesQuery = useQuery({
    queryKey: ['candidate-resumes'],
    queryFn: () => fetchMyResumes(token),
    enabled: Boolean(token)
  });

  const applyMutation = useMutation({
    mutationFn: (payload: { jobId: string; resumeId: string }) => applyToJob(payload, token),
    onSuccess: (_data, variables) => {
      setApplyError(null);
      setApplyMessage('Application submitted successfully.');
      queryClient.setQueryData<Recommendation | undefined>(['candidate-recommendations'], (current) => {
        if (!current) return current;
        return {
          ...current,
          recommendedJobs: current.recommendedJobs.filter((job) => job.jobId !== variables.jobId)
        };
      });
      queryClient.invalidateQueries({ queryKey: ['candidate-applications'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-recommendations'] });
      navigate('/candidate/applications');
    },
    onError: (error: Error) => {
      setApplyMessage(null);
      setApplyError(error.message);
    }
  });

  const job = jobQuery.data;
  const resumes = resumesQuery.data ?? [];
  const atsMutation = useMutation({
    mutationFn: () => atsScanJob(jobId, token),
    onSuccess: (data) => {
      setAtsError(null);
      setAtsReport(data);
    },
    onError: (error: Error) => {
      setAtsReport(null);
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setAtsError('Resume not found for this job. Please upload a resume and try again.');
          return;
        }
        if (error.status === 503) {
          setAtsError('ATS scan service is temporarily unavailable. Try again later.');
          return;
        }
      }
      setAtsError(error.message);
    }
  });

  const handleAtsScan = () => {
    if (!jobId) return;
    atsMutation.mutate();
  };


  useEffect(() => {
    if (!selectedResume && resumes.length) {
      const firstParsed = resumes.find((resume) => resume.status === 'parsed');
      if (firstParsed) {
        setSelectedResume(firstParsed._id);
      }
    }
  }, [resumes, selectedResume]);

  const metadataEntries = useMemo(() => {
    if (!job?.metadata) return [];
    return Object.entries(job.metadata);
  }, [job]);

  const handleApply = () => {
    if (!jobId || !selectedResume) {
      setApplyError('Select a resume before applying.');
      return;
    }
    applyMutation.mutate({ jobId, resumeId: selectedResume });
  };

  return (
    <div className="space-y-6">
      {job ? (
        <PageHeader title={job.title} subtitle={job.location || 'Remote / Flexible'} />
      ) : (
        <PageHeader title="Job Detail" subtitle="Loading role information…" />
      )}

      {jobQuery.isLoading && <LoadingState message="Loading job…" />}
      {jobQuery.isError && <ErrorState message={(jobQuery.error as Error).message} />}

      {job ? (
        <>
          <SectionCard title="About this role" description={job.employmentType}>
            <p className="text-sm text-brand-ash whitespace-pre-line">{job.description}</p>
            <div className="mt-4 space-y-4">
              <div>
                <strong>Required skills</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(job.requiredSkills || []).map((skill) => (
                    <span key={skill} className="chip">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              {job.niceToHaveSkills && job.niceToHaveSkills.length > 0 && (
                <div>
                  <strong>Nice to have</strong>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {job.niceToHaveSkills.map((skill) => (
                      <span key={skill} className="chip">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {metadataEntries.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-slate-50 p-4 text-sm">
                      <div className="text-xs uppercase tracking-wide text-brand-ash">{key}</div>
                      <div className="text-brand-navy">{String(value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Apply with a resume" description="Select one of your parsed resumes to submit.">
            {resumesQuery.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Skeleton key={index} className="h-20" />
                ))}
              </div>
            )}
            {resumesQuery.isError && <ErrorState message={(resumesQuery.error as Error).message} />}

            {!resumesQuery.isLoading && resumes.length === 0 && (
              <p className="text-sm text-brand-ash">
                You have no uploaded resumes yet.{' '}
                <Link className="text-brand-accent" to="/candidate/resumes">
                  Upload one here.
                </Link>
              </p>
            )}

            <div className="space-y-3">
              {resumes.map((resume: ResumePayload) => (
                <label
                  key={resume._id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <input
                    type="radio"
                    name="resume"
                    value={resume._id}
                    disabled={resume.status !== 'parsed'}
                    checked={selectedResume === resume._id}
                    onChange={() => setSelectedResume(resume._id)}
                  />
                  <div>
                    <div className="font-semibold text-brand-navy">{resume.originalFileName || 'Resume'}</div>
                    <div className="text-xs text-brand-ash">Status: {resume.status}</div>
                    {resume.parsedData?.summary && (
                      <p className="mt-1 text-sm text-brand-ash">{resume.parsedData.summary}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button className="btn btn-primary flex-1 sm:flex-initial" disabled={applyMutation.isPending} onClick={handleApply}>
                {applyMutation.isPending ? 'Submitting…' : 'Apply'}
              </button>
              {applyMessage && <span className="text-sm text-emerald-600">{applyMessage}</span>}
              {applyError && <span className="text-sm text-rose-600">{applyError}</span>}
            </div>
          </SectionCard>

          <SectionCard title="ATS Readiness" description="Run an ATS scan to see keyword and format gaps.">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                className="btn btn-secondary w-full sm:w-auto"
                onClick={handleAtsScan}
                disabled={atsMutation.isPending || jobQuery.isLoading}
              >
                {atsMutation.isPending ? 'Scanning…' : 'ATS Scan'}
              </button>
              {atsError && (
                <span className="text-sm text-rose-600">
                  {atsError}{' '}
                  {atsError.toLowerCase().includes('upload') && (
                    <Link className="text-brand-accent" to="/candidate/resumes">
                      Upload resume
                    </Link>
                  )}
                </span>
              )}
            </div>

            {atsMutation.isPending && (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-6" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            )}

            {!atsMutation.isPending && atsReport && (
              <div className="mt-4">
                <ATSReport report={atsReport} />
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
};

export default CandidateJobDetailPage;

