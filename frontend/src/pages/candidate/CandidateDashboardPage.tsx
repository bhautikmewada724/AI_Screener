import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchCandidateRecommendations, fetchMyApplications, fetchMyResumes } from '../../api/candidate';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import StatCard from '../../components/ui/StatCard';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import type { ApplicationRecord, RecommendedJob } from '../../types/api';

const CandidateDashboardPage = () => {
  const { token } = useAuth();

  const resumesQuery = useQuery({
    queryKey: ['candidate-resumes'],
    queryFn: () => fetchMyResumes(token),
    enabled: Boolean(token)
  });

  const applicationsQuery = useQuery({
    queryKey: ['candidate-applications'],
    queryFn: () => fetchMyApplications(token),
    enabled: Boolean(token)
  });

  const recommendationsQuery = useQuery({
    queryKey: ['candidate-recommendations'],
    queryFn: () => fetchCandidateRecommendations(token),
    enabled: Boolean(token)
  });

  const resumeCount = resumesQuery.data?.length ?? 0;
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {
      applied: 0,
      in_review: 0,
      shortlisted: 0,
      rejected: 0,
      hired: 0
    };

    (applicationsQuery.data?.data || []).forEach((application) => {
      map[application.status] = (map[application.status] || 0) + 1;
    });

    return map;
  }, [applicationsQuery.data]);

  const completion = useMemo(() => {
    const steps = [
      resumeCount > 0,
      (applicationsQuery.data?.data.length ?? 0) > 0
    ];
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
  }, [resumeCount, applicationsQuery.data]);

  const recentApplications = useMemo(() => {
    const list = [...(applicationsQuery.data?.data || [])];
    return list
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [applicationsQuery.data]);

  const topRecommendations = (recommendationsQuery.data?.recommendedJobs || []).slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader title="Candidate Dashboard" subtitle="Track your resumes, applications, and progress." />

      {(resumesQuery.isError || applicationsQuery.isError) && (
        <ErrorState
          message={
            (resumesQuery.error as Error)?.message ||
            (applicationsQuery.error as Error)?.message ||
            'Failed to load dashboard data'
          }
        />
      )}

      {resumesQuery.isLoading || applicationsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Uploaded Resumes" value={resumeCount} />
          <StatCard label="Active Applications" value={statusCounts.applied + statusCounts.in_review} />
          <StatCard label="Total Submissions" value={applicationsQuery.data?.data.length ?? 0} />
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Profile Completion" description="Complete these steps to improve your visibility.">
          <div>
            <div className="flex items-center justify-between text-sm text-brand-ash">
              <span>{completion}% complete</span>
              <span>{completion === 100 ? 'Great job!' : 'Keep going'}</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-accent" style={{ width: `${completion}%` }} />
            </div>
          </div>
          <ul className="space-y-2 text-sm text-brand-ash">
            <li>
              {resumeCount > 0 ? '✅' : '⬜'} Upload at least one resume{' '}
              {resumeCount === 0 && (
                <Link className="text-brand-accent" to="/candidate/resumes">
                  Upload now
                </Link>
              )}
            </li>
            <li>
              {(applicationsQuery.data?.data.length ?? 0) > 0 ? '✅' : '⬜'} Apply to an open role{' '}
              {(applicationsQuery.data?.data.length ?? 0) === 0 && (
                <Link className="text-brand-accent" to="/candidate/jobs">
                  Browse jobs
                </Link>
              )}
            </li>
          </ul>
        </SectionCard>
        <SectionCard title="Quick Actions">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link className="btn btn-primary w-full justify-center" to="/candidate/resumes">
              Upload Resume
            </Link>
            <Link className="btn btn-secondary w-full justify-center" to="/candidate/jobs">
              Explore Jobs
            </Link>
          </div>
        </SectionCard>
        <SectionCard
          title="Recommendations"
          description="Tailored roles based on your skills."
          actions={
            <Link className="text-sm font-semibold text-brand-accent" to="/candidate/recommendations">
              View all
            </Link>
          }
        >
          {recommendationsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          ) : recommendationsQuery.isError ? (
            <p className="text-sm text-red-500">
              {(recommendationsQuery.error as Error).message || 'Unable to load recommendations.'}
            </p>
          ) : topRecommendations.length === 0 ? (
            <p className="text-sm text-brand-ash">Upload a resume to see recommended roles.</p>
          ) : (
            <div className="space-y-3">
              {topRecommendations.map((rec: RecommendedJob) => (
                <div key={rec.jobId} className="rounded-xl border border-slate-100 bg-white p-3 shadow-card-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-brand-navy">
                        {rec.job?.title || rec.jobSnapshot?.title || 'Job opportunity'}
                      </div>
                      <div className="text-xs text-brand-ash">
                        {rec.job?.location || rec.jobSnapshot?.location || 'Remote / Flexible'}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Recommended
                    </span>
                  </div>
                  {rec.reason && <div className="mt-1 text-xs text-brand-navy">{rec.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>

      <SectionCard title="Application Status" description="Current snapshot across your hiring pipeline.">
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="space-y-1 rounded-2xl bg-slate-50 p-5 shadow-card-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-ash">
                {status.replace('_', ' ')}
              </div>
              <div className="text-3xl font-semibold text-brand-navy">{count}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Applications" description="Latest submissions and their statuses.">
        {recentApplications.length === 0 ? (
          <p className="text-sm text-brand-ash">You haven’t applied to any roles yet.</p>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Match</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentApplications.map((application) => (
                      <tr key={application._id}>
                        <td>{renderJobTitle(application)}</td>
                        <td>
                          <span className={`status-badge ${application.status}`}>{application.status.replace('_', ' ')}</span>
                        </td>
                        <td>
                          {typeof application.matchScore === 'number' ? `${Math.round(application.matchScore * 100)}%` : '—'}
                        </td>
                        <td>{new Date(application.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-4 lg:hidden">
              {recentApplications.map((application) => (
                <div key={application._id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-brand-navy">{renderJobTitle(application)}</div>
                    <span className={`status-badge ${application.status}`}>{application.status.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-2 text-sm text-brand-ash">
                    Submitted {new Date(application.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 text-sm text-brand-navy">
                    Match: {typeof application.matchScore === 'number' ? `${Math.round(application.matchScore * 100)}%` : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
};

const renderJobTitle = (application: ApplicationRecord) => {
  if (application.jobId && typeof application.jobId !== 'string') {
    return application.jobId.title;
  }
  return 'Job posting';
};

export default CandidateDashboardPage;

