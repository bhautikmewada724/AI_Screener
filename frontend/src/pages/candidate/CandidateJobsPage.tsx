import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchOpenJobs } from '../../api/candidate';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import type { JobDescription } from '../../types/api';

const CandidateJobsPage = () => {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const jobsQuery = useQuery({
    queryKey: ['public-jobs'],
    queryFn: () => fetchOpenJobs({}, token),
    enabled: Boolean(token)
  });

  const jobs = jobsQuery.data?.data ?? [];

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        !search ||
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        (job.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesLocation = !locationFilter || (job.location || '').toLowerCase().includes(locationFilter.toLowerCase());
      return matchesSearch && matchesLocation;
    });
  }, [jobs, search, locationFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Open Roles" subtitle="Browse and apply to roles that match your skills." />

      <SectionCard title="Filters" className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-brand-ash">
          Search
          <input
            type="text"
            placeholder="Search by title or keywords"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-brand-ash">
          Location
          <input
            type="text"
            placeholder="City, region, or remote"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2"
          />
        </label>
      </SectionCard>

      {jobsQuery.isError && <ErrorState message={(jobsQuery.error as Error).message} />}

      {jobsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((job) => (
              <JobCard key={job._id} job={job} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-brand-ash">No jobs match your current filters.</p>
          )}
        </>
      )}
    </div>
  );
};

const JobCard = ({ job }: { job: JobDescription }) => {
  return (
    <SectionCard
      title={job.title}
      description={job.location || 'Remote / Flexible'}
      actions={<Link className="btn btn-primary" to={`/candidate/jobs/${job._id}`}>View</Link>}
    >
      <div className="text-sm text-brand-ash">
        {(job.description || '').slice(0, 160)}
        {job.description && job.description.length > 160 ? '…' : ''}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(job.tags || job.requiredSkills || []).slice(0, 4).map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
      </div>
    </SectionCard>
  );
};

export default CandidateJobsPage;

