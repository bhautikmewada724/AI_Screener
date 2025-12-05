import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { deleteJob, fetchJobs } from '../api/jobs';
import { listUsers } from '../api/admin';
import { useAuth } from '../hooks/useAuth';

const AdminJobsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const jobsQuery = useQuery({
    queryKey: ['admin-jobs', search],
    queryFn: () => fetchJobs(token, { limit: 100, search }),
    enabled: !!token
  });

  const hrQuery = useQuery({
    queryKey: ['admin-hrs'],
    queryFn: () => listUsers({ limit: 200, role: 'hr' }, token),
    enabled: !!token
  });

  const hrLookup = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    hrQuery.data?.data?.forEach((hr) => map.set(hr.id, { name: hr.name, email: hr.email }));
    return map;
  }, [hrQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
          Admin · Job Management
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Job Management</h1>
          <p className="mt-1 text-slate-500">Create, edit, assign, or retire job postings across the org.</p>
        </div>
      </header>

      <section className="card flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex w-full gap-3">
          <input
            type="text"
            placeholder="Search by title, location, or tag"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
          />
          <button className="btn btn-primary whitespace-nowrap" onClick={() => navigate('/admin/jobs/new')}>
            Add Job
          </button>
        </div>
        <p className="text-sm text-slate-500">Assign ownership instantly so HR teams see jobs on their dashboard.</p>
      </section>

      <section className="card overflow-hidden">
        {jobsQuery.isLoading && <p className="text-sm text-slate-500">Loading jobs…</p>}
        {jobsQuery.isError && (
          <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Failed to load jobs: {(jobsQuery.error as Error).message}
          </p>
        )}
        {jobsQuery.data?.data?.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Owner (HR)</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobsQuery.data.data.map((job: any) => (
                  <tr key={job._id}>
                    <td className="max-w-sm">
                      <div className="font-semibold text-slate-900">{job.title}</div>
                      <div className="text-sm text-slate-500">{job.location || 'Remote/anywhere'}</div>
                    </td>
                    <td>
                      {job.hrId ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-900">{hrLookup.get(job.hrId)?.name || 'Assigned HR'}</div>
                          <div className="text-xs text-slate-500">{hrLookup.get(job.hrId)?.email}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${job.status}`}>{job.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          className="btn btn-secondary text-sm"
                          to={`/hr/jobs/${job._id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </Link>
                        <Link className="btn btn-primary text-sm" to={`/admin/jobs/${job._id}/edit`}>
                          Edit
                        </Link>
                        <button
                          className="btn btn-danger text-sm"
                          onClick={() => {
                            if (window.confirm('Delete this job posting?')) {
                              deleteMutation.mutate(job._id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !jobsQuery.isLoading && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No jobs found. Try another search or create a new posting.
            </p>
          )
        )}
      </section>
    </div>
  );
};

export default AdminJobsPage;
