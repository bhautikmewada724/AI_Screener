import Application from '../models/Application.js';
import JobDescription from '../models/JobDescription.js';
import Recommendation from '../models/Recommendation.js';
import Resume from '../models/Resume.js';
import { getRecommendations } from './aiService.js';
import { getEffectiveParsedData } from './resumeCorrectionService.js';

const TTL_MINUTES = parseInt(process.env.RECOMMENDATION_TTL_MINUTES || '360', 10);
const TTL_MS = TTL_MINUTES * 60 * 1000;

const pickField = (obj = {}, ...keys) => {
  for (const key of keys) {
    if (typeof obj[key] !== 'undefined' && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
};

const isStale = (doc) => {
  if (!doc || !doc.generatedAt) return true;
  const age = Date.now() - new Date(doc.generatedAt).getTime();
  return age > TTL_MS;
};

const toJobSnapshot = (job) => ({
  title: job.title,
  location: job.location,
  requiredSkills: job.requiredSkills || [],
  niceToHaveSkills: job.niceToHaveSkills || []
});

export const loadCandidateProfile = async (candidateId) => {
  const latestResume = await Resume.findOne({ userId: candidateId, status: 'parsed' })
    .sort({ createdAt: -1 })
    .lean();

  const parsedData = getEffectiveParsedData(latestResume);
  const skills = parsedData?.skills || [];
  const location = parsedData?.location;
  const embeddings = parsedData?.embeddings || [];
  const summary = parsedData?.summary;
  const totalYearsExperience = parsedData?.totalYearsExperience;

  return {
    candidate: {
      id: candidateId?.toString(),
      skills,
      preferred_locations: location ? [location] : [],
      embeddings,
      location,
      summary,
      total_years_experience: totalYearsExperience
    },
    resume: latestResume
  };
};

export const fetchEligibleJobs = async (candidateId, excludedJobIds = new Set()) => {
  const applications = await Application.find({ candidateId }).select('jobId').lean();
  const appliedJobIds = new Set(applications.map((app) => app.jobId.toString()));

  const blockedIds = new Set([...excludedJobIds, ...appliedJobIds]);

  const query = blockedIds.size
    ? { status: 'open', _id: { $nin: Array.from(blockedIds) } }
    : { status: 'open' };

  const jobs = await JobDescription.find(query).lean();
  return { jobs, appliedJobIds };
};

const buildAiPayload = ({ candidateProfile, jobs }) => {
  const mappedJobs = jobs.map((job) => ({
    job_id: job._id.toString(),
    title: job.title,
    required_skills: job.requiredSkills || [],
    nice_to_have_skills: job.niceToHaveSkills || [],
    embeddings: job.embeddings || [],
    location: job.location,
    seniority: job.metadata?.get ? job.metadata.get('seniorityLevel') : job.metadata?.seniorityLevel,
    job_category: job.metadata?.get ? job.metadata.get('jobCategory') : job.metadata?.jobCategory
  }));

  return {
    candidate: candidateProfile,
    jobs: mappedJobs
  };
};

const mergeStatus = (existingByJobId, jobId, appliedJobIds) => {
  if (appliedJobIds.has(jobId)) return 'applied';
  return existingByJobId.get(jobId)?.status || 'shown';
};

const applySavedBias = (entries, statusByJobId) =>
  entries
    .map((entry) => {
      const jobId = entry.jobId?.toString();
      const previous = jobId ? statusByJobId.get(jobId) : null;
      const boost = previous?.status === 'saved' ? 0.05 : 0;
      return {
        ...entry,
        score: Math.min(1, (entry.score || 0) + boost)
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

export const generateRecommendations = async (candidateId) => {
  const existing = await Recommendation.findOne({ candidateId }).lean();
  const dismissedJobIds = new Set(
    (existing?.recommendedJobs || [])
      .filter((entry) => entry.status === 'dismissed')
      .map((entry) => entry.jobId?.toString())
      .filter(Boolean)
  );

  const statusByJobId = new Map(
    (existing?.recommendedJobs || []).map((entry) => [entry.jobId?.toString(), entry])
  );

  const { candidate } = await loadCandidateProfile(candidateId);
  const { jobs, appliedJobIds } = await fetchEligibleJobs(candidateId, dismissedJobIds);

  if (!jobs.length || !(candidate.skills?.length || candidate.embeddings?.length)) {
    const cleared = await Recommendation.findOneAndUpdate(
      { candidateId },
      { $set: { recommendedJobs: [], generatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return cleared.populate('recommendedJobs.jobId');
  }

  const aiPayload = buildAiPayload({ candidateProfile: candidate, jobs });
  const aiResponse = await getRecommendations(aiPayload);

  const ranked = pickField(aiResponse, 'ranked_jobs', 'rankedJobs') || [];
  const generatedAt = new Date(pickField(aiResponse, 'generated_at', 'generatedAt') || Date.now());

  const recommendedJobs = ranked.map((item) => {
    const jobId = item.job_id || item.jobId;
    const job = jobs.find((j) => j._id.toString() === jobId);
    const status = mergeStatus(statusByJobId, jobId, appliedJobIds);

    return {
      jobId,
      score: item.score,
      rank: item.rank,
      reason: item.reason,
      status,
      jobSnapshot: job ? toJobSnapshot(job) : undefined,
      lastRecommendedAt: generatedAt
    };
  });

  const boostedRecommendations = applySavedBias(recommendedJobs, statusByJobId);

  const doc = await Recommendation.findOneAndUpdate(
    { candidateId },
    {
      $set: {
        recommendedJobs: boostedRecommendations,
        generatedAt
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('recommendedJobs.jobId');

  return doc;
};

export const getOrGenerateRecommendations = async (candidateId, { forceRefresh = false } = {}) => {
  const current = await Recommendation.findOne({ candidateId }).populate('recommendedJobs.jobId');

  if (!forceRefresh && current && !isStale(current)) {
    return current;
  }

  return generateRecommendations(candidateId);
};

export const applyRecommendationFeedback = async (candidateId, { jobId, feedbackType, feedbackReason }) => {
  const allowed = ['dismissed', 'saved'];
  if (!allowed.includes(feedbackType)) {
    const error = new Error('Unsupported feedback type.');
    error.status = 400;
    throw error;
  }

  const recommendation = await Recommendation.findOne({ candidateId });
  if (!recommendation) {
    const notFound = new Error('No recommendations found to update.');
    notFound.status = 404;
    throw notFound;
  }

  const exists = recommendation.recommendedJobs.some((entry) => entry.jobId.toString() === jobId);
  if (!exists) {
    const notFound = new Error('Job is not in the current recommendations.');
    notFound.status = 404;
    throw notFound;
  }

  const updatedJobs = recommendation.recommendedJobs.map((entry) => {
    if (entry.jobId.toString() !== jobId) {
      return entry;
    }
    return {
      ...entry.toObject(),
      status: feedbackType,
      feedbackReason: feedbackReason || entry.feedbackReason
    };
  });

  const doc = await Recommendation.findOneAndUpdate(
    { candidateId },
    { $set: { recommendedJobs: updatedJobs } },
    { new: true }
  ).populate('recommendedJobs.jobId');

  return doc;
};
