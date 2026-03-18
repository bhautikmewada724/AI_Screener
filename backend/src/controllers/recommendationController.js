import {
  applyRecommendationFeedback,
  generateRecommendations,
  getOrGenerateRecommendations
} from '../services/recommendationService.js';

const toJobShape = (jobId) => {
  if (!jobId || typeof jobId !== 'object') return undefined;

  const id = jobId._id?.toString?.() || jobId.id || undefined;
  return {
    _id: id,
    title: jobId.title,
    location: jobId.location,
    requiredSkills: jobId.requiredSkills || [],
    niceToHaveSkills: jobId.niceToHaveSkills || [],
    status: jobId.status,
    tags: jobId.tags || [],
    metadata: jobId.metadata
  };
};

const serializeRecommendation = (doc) => {
  if (!doc) {
    return { recommendedJobs: [], generatedAt: new Date().toISOString() };
  }

  return {
    id: doc._id?.toString?.(),
    candidateId: doc.candidateId?.toString?.(),
    generatedAt: doc.generatedAt,
    recommendedJobs: (doc.recommendedJobs || [])
      .filter((entry) => entry.status !== 'applied')
      .map((entry) => {
      const jobId = entry.jobId?._id?.toString?.() || entry.jobId?.toString?.();
      const snapshotJob =
        !toJobShape(entry.jobId) && entry.jobSnapshot
          ? {
              _id: jobId,
              title: entry.jobSnapshot.title,
              location: entry.jobSnapshot.location,
              requiredSkills: entry.jobSnapshot.requiredSkills || [],
              niceToHaveSkills: entry.jobSnapshot.niceToHaveSkills || [],
              status: 'open'
            }
          : undefined;
      return {
        jobId,
        reason: entry.reason,
        status: entry.status,
        feedbackReason: entry.feedbackReason,
        job: toJobShape(entry.jobId) || snapshotJob,
        jobSnapshot: entry.jobSnapshot,
        lastRecommendedAt: entry.lastRecommendedAt
      };
    })
  };
};

export { serializeRecommendation };

export const getCandidateRecommendations = async (req, res, next) => {
  try {
    const recommendation = await getOrGenerateRecommendations(req.user.id);
    res.json(serializeRecommendation(recommendation));
  } catch (error) {
    next(error);
  }
};

export const refreshCandidateRecommendations = async (req, res, next) => {
  try {
    const recommendation = await generateRecommendations(req.user.id);
    res.json(serializeRecommendation(recommendation));
  } catch (error) {
    next(error);
  }
};

export const submitRecommendationFeedback = async (req, res, next) => {
  try {
    const { jobId, feedbackType, feedbackReason } = req.body || {};
    const validTypes = ['dismissed', 'saved'];
    const isValidObjectId = typeof jobId === 'string' && /^[a-fA-F0-9]{24}$/.test(jobId);

    if (!jobId || !feedbackType) {
      return res.status(400).json({ message: 'jobId and feedbackType are required.' });
    }
    if (!isValidObjectId) {
      return res.status(400).json({ message: 'jobId must be a valid object id.' });
    }
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ message: 'feedbackType must be one of dismissed|saved.' });
    }

    const updated = await applyRecommendationFeedback(req.user.id, {
      jobId,
      feedbackType,
      feedbackReason
    });
    res.json(serializeRecommendation(updated));
  } catch (error) {
    next(error);
  }
};

