import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchJobs } from '../api/hr';
import { useAuth } from '../hooks/useAuth';
import type { JobDescription } from '../types/api';

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

  const renderJobCard = (job: JobDescription) => (
    <Link key={job._id} to={`/hr/jobs/${job._id}`} className="card" style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>{job.title}</h3>
        <span className={`status-badge ${job.status}`}>{job.status.replace('_', ' ')}</span>
      </div>
      <p style={{ color: '#475569', marginTop: 0 }}>{job.location || 'Remote / Flexible'}</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(job.tags || job.requiredSkills?.slice(0, 3) || []).map((chip) => (
          <span
            key={chip}
            style={{
              fontSize: '0.85rem',
              background: '#e2e8f0',
              borderRadius: '999px',
              padding: '0.15rem 0.75rem'
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </Link>
  );

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {summary.map((item) => (
          <div key={item.label} className="card" style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{item.label}</p>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Job Postings</h2>
          <small style={{ color: '#94a3b8' }}>Select a role to open its workflow</small>
        </div>

        {jobsQuery.isLoading && <p>Loading jobs…</p>}
        {jobsQuery.isError && (
          <p style={{ color: '#b91c1c' }}>Failed to load jobs: {(jobsQuery.error as Error)?.message}</p>
        )}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {jobs.map(renderJobCard)}
        </div>

        {!jobsQuery.isLoading && jobs.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: '#94a3b8' }}>
            No job postings yet. Use the backend HR endpoints to seed one.
          </div>
        )}
      </section>
    </div>
  );
};

export default HrDashboardPage;


