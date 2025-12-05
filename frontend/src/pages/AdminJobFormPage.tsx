import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { listUsers } from '../api/admin';
import { createJob, getJobById, updateJob } from '../api/jobs';
import { useAuth } from '../hooks/useAuth';
import type { JobDescription, UserProfile } from '../types/api';

interface JobFormState {
  title: string;
  description: string;
  location: string;
  employmentType: string;
  salaryRange: { min: string; max: string; currency: string };
  requiredSkills: string;
  tags: string;
  status: string;
  openings: number;
  reviewStages: string;
  hrId: string;
}

const defaultJob: JobFormState = {
  title: '',
  description: '',
  location: '',
  employmentType: 'full-time',
  salaryRange: { min: '', max: '', currency: 'USD' },
  requiredSkills: '',
  tags: '',
  status: 'open',
  openings: 1,
  reviewStages: '',
  hrId: ''
};

const inputClasses =
  'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';
const selectClasses = `${inputClasses} pr-10`;
const textareaClasses = 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30';

const AdminJobFormPage = () => {
  const { jobId } = useParams();
  const isEdit = Boolean(jobId);
  const { token } = useAuth();
  const navigate = useNavigate();
  const [formState, setFormState] = useState(defaultJob);

  useQuery({
    queryKey: ['admin-job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const job = (await getJobById(jobId, token)) as JobDescription;
      setFormState({
        title: job.title,
        description: job.description,
        location: job.location || '',
        employmentType: job.employmentType || 'full-time',
        salaryRange: {
          min: job.salaryRange?.min != null ? String(job.salaryRange.min) : '',
          max: job.salaryRange?.max != null ? String(job.salaryRange.max) : '',
          currency: job.salaryRange?.currency ?? 'USD'
        },
        requiredSkills: (job.requiredSkills || []).join(', '),
        tags: (job.tags || []).join(', '),
        status: job.status || 'draft',
        openings: job.openings ?? 1,
        reviewStages: (job.reviewStages || []).join(', '),
        hrId: job.hrId || ''
      });
      return job;
    },
    enabled: isEdit && !!token
  });

  const hrQuery = useQuery({
    queryKey: ['admin-hrs'],
    queryFn: () => listUsers({ limit: 200, role: 'hr' }, token),
    enabled: !!token
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => (isEdit ? updateJob(jobId!, payload, token) : createJob(payload, token)),
    onSuccess: () => navigate('/admin/jobs')
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    if (name.startsWith('salaryRange.')) {
      const key = name.split('.')[1];
      setFormState((prev) => ({
        ...prev,
        salaryRange: {
          ...prev.salaryRange,
          [key]: value
        }
      }));
      return;
    }
    if (name === 'openings') {
      setFormState((prev) => ({ ...prev, [name]: Number(value) }));
      return;
    }
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      title: formState.title,
      description: formState.description,
      location: formState.location,
      employmentType: formState.employmentType,
      salaryRange: {
        min: Number(formState.salaryRange.min) || undefined,
        max: Number(formState.salaryRange.max) || undefined,
        currency: formState.salaryRange.currency
      },
      requiredSkills: typeof formState.requiredSkills === 'string'
        ? formState.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
        : formState.requiredSkills,
      tags: typeof formState.tags === 'string'
        ? formState.tags.split(',').map((s) => s.trim()).filter(Boolean)
        : formState.tags,
      status: formState.status,
      openings: formState.openings,
      reviewStages: typeof formState.reviewStages === 'string'
        ? formState.reviewStages.split(',').map((s) => s.trim()).filter(Boolean)
        : formState.reviewStages,
      hrId: formState.hrId || undefined
    };
    mutation.mutate(payload);
  };

  const hrOptions: UserProfile[] = hrQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
          Admin · {isEdit ? 'Edit Job' : 'Create Job'}
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{isEdit ? 'Edit Job Posting' : 'Create Job Posting'}</h1>
          <p className="mt-1 text-slate-500">
            {isEdit
              ? 'Update any field, adjust compensation bands, or reassign ownership.'
              : 'Publish a new requisition and assign it to an HR owner instantly.'}
          </p>
        </div>
      </header>

      <section className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Job title
              <input name="title" value={formState.title} onChange={handleChange} required className={inputClasses} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Location
              <input
                name="location"
                value={formState.location}
                onChange={handleChange}
                placeholder="Remote, New York, etc."
                className={inputClasses}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Description
            <textarea
              name="description"
              value={formState.description}
              onChange={handleChange}
              rows={6}
              required
              className={textareaClasses}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Employment type
              <select name="employmentType" value={formState.employmentType} onChange={handleChange} className={selectClasses}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Openings
              <input type="number" name="openings" value={formState.openings} onChange={handleChange} min={1} className={inputClasses} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Status
              <select name="status" value={formState.status} onChange={handleChange} className={selectClasses}>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="on_hold">On hold</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Salary min
              <input name="salaryRange.min" value={formState.salaryRange.min} onChange={handleChange} className={inputClasses} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Salary max
              <input name="salaryRange.max" value={formState.salaryRange.max} onChange={handleChange} className={inputClasses} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Currency
              <input name="salaryRange.currency" value={formState.salaryRange.currency} onChange={handleChange} className={inputClasses} />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Required skills (comma-separated)
            <input name="requiredSkills" value={formState.requiredSkills} onChange={handleChange} className={inputClasses} />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Review stages (comma-separated)
            <input name="reviewStages" value={formState.reviewStages} onChange={handleChange} className={inputClasses} />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Tags (comma-separated)
            <input name="tags" value={formState.tags} onChange={handleChange} className={inputClasses} />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Assign to HR
            <select name="hrId" value={formState.hrId} onChange={handleChange} className={selectClasses}>
              <option value="">Unassigned</option>
              {hrOptions.map((hr) => (
                <option key={hr.id} value={hr.id}>
                  {hr.name} ({hr.email})
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="btn btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
            </button>
            <p className="text-sm text-slate-500">
              {isEdit ? 'Changes sync instantly to the HR console and review queues.' : 'New jobs appear in the assigned HR dashboard immediately.'}
            </p>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AdminJobFormPage;


