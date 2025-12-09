import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchCandidateRecommendations,
  refreshCandidateRecommendations,
  sendRecommendationFeedback
} from '../../api/candidate';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import type { Recommendation, RecommendedJob } from '../../types/api';

const strengthBucket = (score: number) => {
  if (score >= 0.75) return { label: 'Strong', className: 'bg-emerald-100 text-emerald-700' };
  if (score >= 0.5) return { label: 'Medium', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Weak', className: 'bg-slate-100 text-slate-600' };
};

const CandidateRecommendationsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const recommendationsQuery = useQuery({
    queryKey: ['candidate-recommendations'],
    queryFn: () => fetchCandidateRecommendations(token),
    enabled: Boolean(token)
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshCandidateRecommendations(token),
    onSuccess: (data) => {
      queryClient.setQueryData(['candidate-recommendations'], data);
    }
  });

  const feedbackMutation = useMutation({
    mutationFn: (payload: { jobId: string; feedbackType: 'dismissed' | 'saved' }) =>
      sendRecommendationFeedback(payload, token),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['candidate-recommendations'] });
      const previous = queryClient.getQueryData<Recommendation>(['candidate-recommendations']);
      queryClient.setQueryData<Recommendation | undefined>(['candidate-recommendations'], (current) => {
        if (!current) return current;
        const updatedJobs =
          payload.feedbackType === 'dismissed'
            ? current.recommendedJobs.filter((job: RecommendedJob) => job.jobId !== payload.jobId)
            : current.recommendedJobs.map((job: RecommendedJob) =>
                job.jobId === payload.jobId ? { ...job, status: 'saved' } : job
              );
        return { ...current, recommendedJobs: updatedJobs };
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['candidate-recommendations'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-recommendations'] });
    }
  });

  const recommendations = recommendationsQuery.data?.recommendedJobs || [];
  const isLoading = recommendationsQuery.isLoading || refreshMutation.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommended Jobs"
        subtitle="Curated suggestions based on your skills, resume, and preferences."
        actions={
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isLoading}
            >
              {refreshMutation.isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link className="btn btn-primary" to="/candidate/jobs">
              Browse all jobs
            </Link>
          </div>
        }
      />

      {recommendationsQuery.isError && (
        <ErrorState message={(recommendationsQuery.error as Error).message || 'Failed to load recommendations.'} />
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          message="Upload a resume and apply to a few roles so we can tailor suggestions for you."
          action={
            <Link className="btn btn-primary" to="/candidate/resumes">
              Upload resume
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((job) => (
            <RecommendationCard
              key={job.jobId}
              job={job}
              onDismiss={(jobId) => feedbackMutation.mutate({ jobId, feedbackType: 'dismissed' })}
              onSave={(jobId) => feedbackMutation.mutate({ jobId, feedbackType: 'saved' })}
              isMutating={feedbackMutation.isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const RecommendationCard = ({
  job,
  onDismiss,
  onSave,
  isMutating
}: {
  job: RecommendedJob;
  onDismiss: (jobId: string) => void;
  onSave: (jobId: string) => void;
  isMutating: boolean;
}) => {
  const [isDismissing, setIsDismissing] = useState(false);
  const jobData = job.job || job.jobSnapshot;
  const location = jobData?.location || 'Remote / Flexible';
  const tags = (jobData?.requiredSkills || jobData?.niceToHaveSkills || []).slice(0, 4);
  const bucket = strengthBucket(job.score);

  const handleDismiss = (jobId: string) => {
    setIsDismissing(true);
    setTimeout(() => onDismiss(jobId), 180);
  };

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <span>{jobData?.title || 'Job opportunity'}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            Recommended
          </span>
        </div>
      }
      description={
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${bucket.className}`}>
            {bucket.label}
          </span>
          <span className="text-xs text-brand-ash">{Math.round(job.score * 100)}% match</span>
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary btn-sm" to={`/candidate/jobs/${job.jobId}`}>
            View & Apply
          </Link>
          <button
            className="btn btn-ghost btn-sm text-brand-ash"
            onClick={() => handleDismiss(job.jobId)}
            disabled={isMutating}
          >
            Not relevant
          </button>
          <button
            className={`btn btn-sm ${job.status === 'saved' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => onSave(job.jobId)}
            disabled={isMutating}
          >
            {job.status === 'saved' ? 'Saved' : 'Save'}
          </button>
        </div>
      }
      className={`transition-opacity duration-200 ${isDismissing ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="text-sm text-brand-ash">{location}</div>
      {job.reason && <div className="mt-2 text-sm text-brand-navy">{job.reason}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
      </div>
    </SectionCard>
  );
};

export default CandidateRecommendationsPage;

