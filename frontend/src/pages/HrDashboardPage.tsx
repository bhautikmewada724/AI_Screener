import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchJobs } from '../api/hr';
import { useAuth } from '../hooks/useAuth';
import type { JobDescription } from '../types/api';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';

const HrDashboardPage = () => {
  const { token } = useAuth();
  const jobsQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: () => fetchJobs(token),
    enabled: Boolean(token)
  });

  const jobs = jobsQuery.data?.data ?? [];
  const openJobs = jobs.filter((job) => job.status === 'open');
  const draftJobs = jobs.filter((job) => job.status === 'draft');

  const summary = useMemo(
    () => [
      { label: 'Total Jobs', value: jobs.length },
      { label: 'Open Roles', value: openJobs.length },
      { label: 'Drafts', value: draftJobs.length }
    ],
    [draftJobs.length, jobs.length, openJobs.length]
  );

  return (
    <div className="page-shell">
      <PageHeader title="HR Dashboard" subtitle="Track and access active job workflows." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold text-brand-navy">Job Postings</h2>
          <small className="text-brand-ash">Select a role to open its workflow.</small>
        </div>

        {jobsQuery.isLoading && <LoadingState message="Loading jobs…" />}
        {jobsQuery.isError && (
          <ErrorState message={`Failed to load jobs: ${(jobsQuery.error as Error)?.message}`} onRetry={() => jobsQuery.refetch()} />
        )}

        {!jobsQuery.isLoading && jobs.length === 0 && (
          <EmptyState message="No job postings yet. Seed data via backend HR endpoints to get started." />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const status = job.status ?? 'draft';
            return (
            <Link key={job._id} to={`/hr/jobs/${job._id}`} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-brand-navy">{job.title}</h3>
                  <p className="text-sm text-brand-ash">{job.location || 'Remote / Flexible'}</p>
                </div>
                <span className={`status-badge ${status}`}>{status.replace('_', ' ')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(job.tags || job.requiredSkills?.slice(0, 3) || []).map((chip) => (
                  <span key={chip} className="chip">
                    {chip}
                  </span>
                ))}
              </div>
            </Link>
          );
          })}
        </div>
      </section>
    </div>
  );
};

export default HrDashboardPage;


