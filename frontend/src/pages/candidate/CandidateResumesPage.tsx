import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyResumes, uploadCandidateResume } from '../../api/candidate';
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
            <ResumeCard key={resume._id} resume={resume} />
          ))}
          {!resumesQuery.data?.length && (
            <p className="text-sm text-brand-ash">Upload your first resume to begin applying.</p>
          )}
        </div>
      )}
    </div>
  );
};

const ResumeCard = ({ resume }: { resume: ResumePayload }) => {
  const uploadedAt = resume.createdAt ? new Date(resume.createdAt).toLocaleString() : 'Unknown upload date';

  return (
    <SectionCard
      title={resume.originalFileName || 'Uploaded Resume'}
      description={`Uploaded ${uploadedAt}`}
      actions={<span className={`status-badge ${resume.status}`}>{resume.status}</span>}
    >
      {resume.status === 'failed' && (
        <p className="text-sm text-rose-600">
          AI parsing failed: {resume.parsedData?.error || 'Please retry with a different file.'}
        </p>
      )}
      <div className="rounded-2xl border border-dashed border-slate-100 bg-slate-50/60 p-4">
        {resume.status === 'parsed' ? (
          <ResumeViewer resume={resume} matchScore={undefined} />
        ) : (
          <p className="text-sm text-brand-ash">AI parsing is still in progress.</p>
        )}
      </div>
    </SectionCard>
  );
};

export default CandidateResumesPage;

