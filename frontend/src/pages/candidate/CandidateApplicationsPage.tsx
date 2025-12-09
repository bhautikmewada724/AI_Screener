import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchMyApplications } from '../../api/candidate';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import type { ApplicationRecord, JobDescription } from '../../types/api';

const CandidateApplicationsPage = () => {
  const { token } = useAuth();

  const applicationsQuery = useQuery({
    queryKey: ['candidate-applications'],
    queryFn: () => fetchMyApplications(token),
    enabled: Boolean(token)
  });

  const applications = applicationsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="My Applications" subtitle="Track every submission and its latest status." />

      {applicationsQuery.isLoading && <LoadingState message="Loading applications…" />}
      {applicationsQuery.isError && <ErrorState message={(applicationsQuery.error as Error).message} />}

      <SectionCard>
        {applicationsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : applications.length === 0 ? (
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application._id}>
                        <td>{renderJobTitle(application.jobId)}</td>
                        <td>
                          <span className={`status-badge ${application.status}`}>{application.status.replace('_', ' ')}</span>
                        </td>
                        <td>
                          {typeof application.matchScore === 'number' ? `${Math.round(application.matchScore * 100)}%` : '—'}
                        </td>
                        <td>{new Date(application.createdAt).toLocaleDateString()}</td>
                        <td>
                          {typeof application.jobId !== 'string' && (
                            <Link className="btn btn-secondary" to={`/candidate/jobs/${application.jobId._id}`}>
                              View job
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-4 lg:hidden">
              {applications.map((application) => (
                <div key={application._id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-brand-navy">{renderJobTitle(application.jobId)}</div>
                    <span className={`status-badge ${application.status}`}>{application.status.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-2 text-sm text-brand-ash">
                    Submitted {new Date(application.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-1 text-sm text-brand-navy">
                    Match:{' '}
                    {typeof application.matchScore === 'number' ? `${Math.round(application.matchScore * 100)}%` : 'Pending'}
                  </div>
                  {typeof application.jobId !== 'string' && (
                    <Link className="btn btn-secondary mt-3 w-full justify-center" to={`/candidate/jobs/${application.jobId._id}`}>
                      View job
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
};

const renderJobTitle = (job: string | JobDescription) => {
  if (typeof job === 'string') {
    return 'Job posting';
  }
  return job.title;
};

export default CandidateApplicationsPage;

