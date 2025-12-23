import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyResumes, uploadCandidateResume, updateResumeParsedData } from '../../api/candidate';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import ErrorState from '../../components/ui/ErrorState';
import type { ResumePayload } from '../../types/api';
import ResumeViewer from '../../components/ResumeViewer';
import Skeleton from '../../components/ui/Skeleton';

const CandidateResumesPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resumesQuery = useQuery({
    queryKey: ['candidate-resumes'],
    queryFn: () => fetchMyResumes(token),
    enabled: Boolean(token)
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCandidateResume(file, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-resumes'] });
      setUploadError(null);
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        setUploadError(error.message);
      } else {
        setUploadError('Failed to upload resume. Please try again.');
      }
    }
  });

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem('resume-file') as HTMLInputElement | null;
    if (!fileInput?.files?.[0]) return;
    uploadMutation.mutate(fileInput.files[0]);
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Resumes" subtitle="Manage your uploads and AI-parsed insights." />

      <SectionCard title="Upload Resume" description="PDF, DOC, or DOCX up to 5MB.">
        <form onSubmit={handleUpload} className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            name="resume-file"
            accept=".pdf,.doc,.docx"
            required
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2"
          />
          <button className="btn btn-primary w-full md:w-auto" disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </form>
        {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
      </SectionCard>

      {resumesQuery.isError && <ErrorState message={(resumesQuery.error as Error).message} />}

      {resumesQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(resumesQuery.data || []).map((resume) => (
            <ResumeCard key={resume._id} resume={resume} token={token} />
          ))}
          {!resumesQuery.data?.length && (
            <p className="text-sm text-brand-ash">Upload your first resume to begin applying.</p>
          )}
        </div>
      )}
    </div>
  );
};

const ResumeCard = ({ resume, token }: { resume: ResumePayload; token?: string }) => {
  const uploadedAt = resume.createdAt ? new Date(resume.createdAt).toLocaleString() : 'Unknown upload date';
  const parsedData =
    resume.parsedDataCorrected && Object.keys(resume.parsedDataCorrected).length
      ? resume.parsedDataCorrected
      : resume.parsedData ?? {};

  const [isEditing, setIsEditing] = useState(false);
  const [draftSkills, setDraftSkills] = useState<string[]>(parsedData.skills ?? []);
  const [draftLocation, setDraftLocation] = useState<string>(parsedData.location ?? '');
  const [draftYears, setDraftYears] = useState<number | ''>(
    typeof parsedData.totalYearsExperience === 'number' ? parsedData.totalYearsExperience : ''
  );
  const [newSkill, setNewSkill] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isEditing) {
      setDraftSkills(parsedData.skills ?? []);
      setDraftLocation(parsedData.location ?? '');
      setDraftYears(typeof parsedData.totalYearsExperience === 'number' ? parsedData.totalYearsExperience : '');
      setFormError(null);
      setFormSuccess(null);
    }
  }, [isEditing, parsedData]);

  const updateMutation = useMutation({
    mutationFn: (payload: { skills?: string[]; totalYearsExperience?: number; location?: string }) =>
      updateResumeParsedData(resume._id, payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-resumes'] });
      setFormError(null);
      setFormSuccess('Corrections saved.');
      setIsEditing(false);
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Failed to save corrections. Please try again.');
      }
    }
  });

  const handleAddSkill = () => {
    const cleaned = newSkill.trim();
    if (!cleaned) return;
    const exists = draftSkills.some((skill) => skill.toLowerCase() === cleaned.toLowerCase());
    if (exists) {
      setNewSkill('');
      return;
    }
    setDraftSkills([...draftSkills, cleaned]);
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setDraftSkills(draftSkills.filter((item) => item.toLowerCase() !== skill.toLowerCase()));
  };

  const handleSave = () => {
    const payload: { skills?: string[]; totalYearsExperience?: number; location?: string } = {};
    if (draftSkills) payload.skills = draftSkills;
    if (draftLocation !== undefined) payload.location = draftLocation.trim();
    if (draftYears !== '') {
      const numericYears = Number(draftYears);
      if (Number.isNaN(numericYears)) {
        setFormError('Years of experience must be a number.');
        return;
      }
      payload.totalYearsExperience = numericYears;
    }

    if (!Object.keys(payload).length) {
      setFormError('Add at least one field to save.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    updateMutation.mutate(payload);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormError(null);
    setFormSuccess(null);
    setDraftSkills(parsedData.skills ?? []);
    setDraftLocation(parsedData.location ?? '');
    setDraftYears(typeof parsedData.totalYearsExperience === 'number' ? parsedData.totalYearsExperience : '');
    setNewSkill('');
  };

  return (
    <SectionCard
      title={resume.originalFileName || 'Uploaded Resume'}
      description={`Uploaded ${uploadedAt}`}
      actions={
        <div className="flex items-center gap-2">
          {resume.isCorrected && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Candidate verified
            </span>
          )}
          <span className={`status-badge ${resume.status}`}>{resume.status}</span>
        </div>
      }
    >
      {resume.status === 'failed' && (
        <p className="text-sm text-rose-600">
          AI parsing failed: {resume.parsedData?.error || 'Please retry with a different file.'}
        </p>
      )}
      <div className="rounded-2xl border border-dashed border-slate-100 bg-slate-50/60 p-4">
        {resume.status === 'parsed' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-brand-ash">
                You can correct skills, total years of experience, and location without changing the original parse.
              </div>
              {!isEditing ? (
                <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                  Edit corrections
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost text-brand-navy" onClick={handleCancel} disabled={updateMutation.isPending}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            {formSuccess && <p className="text-sm text-emerald-600">{formSuccess}</p>}

            {isEditing ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-brand-navy">Skills</label>
                  <div className="flex flex-wrap gap-2">
                    {draftSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-brand-navy"
                      >
                        {skill}
                        <button
                          type="button"
                          className="text-slate-500 hover:text-rose-600"
                          onClick={() => handleRemoveSkill(skill)}
                          aria-label={`Remove ${skill}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {!draftSkills.length && <small className="text-brand-ash">Add your primary skills.</small>}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(event) => setNewSkill(event.target.value)}
                      placeholder="Add a skill"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button type="button" className="btn btn-secondary sm:w-32" onClick={handleAddSkill}>
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-brand-navy">Total years of experience</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={0.1}
                    value={draftYears}
                    onChange={(event) => setDraftYears(event.target.value === '' ? '' : Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="e.g., 5.5"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-brand-navy">Location</label>
                  <input
                    type="text"
                    value={draftLocation}
                    onChange={(event) => setDraftLocation(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="City, Country or Remote"
                  />
                </div>
              </div>
            ) : (
              <ResumeViewer resume={resume} matchScore={undefined} />
            )}
          </div>
        ) : (
          <p className="text-sm text-brand-ash">AI parsing is still in progress.</p>
        )}
      </div>
    </SectionCard>
  );
};

export default CandidateResumesPage;

