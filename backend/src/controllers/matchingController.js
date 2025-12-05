import JobDescription from '../models/JobDescription.js';
import Resume from '../models/Resume.js';
import { rankCandidatesForJob, scoreCandidateForJob } from '../services/matchingService.js';

export const getRankedMatches = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const minScore = Number(req.query.minScore) || 0;
    const limit = Number(req.query.limit) || 20;
    const refresh = req.query.refresh === 'true';

    const matches = await rankCandidatesForJob({
      jobId,
      minScore,
      limit,
      refresh
    });

    res.json({ data: matches });
  } catch (error) {
    next(error);
  }
};

export const simulateMatch = async (req, res, next) => {
  try {
    const { jobId, resumeId } = req.body || {};

    if (!jobId || !resumeId) {
      return res.status(400).json({ message: 'jobId and resumeId are required.' });
    }

    const [job, resume] = await Promise.all([JobDescription.findById(jobId), Resume.findById(resumeId)]);

    if (!job || !resume) {
      return res.status(404).json({ message: 'Job or resume not found.' });
    }

    const match = await scoreCandidateForJob({ job, resume, forceRefresh: true });

    res.json({
      matchScore: match.matchScore,
      matchedSkills: match.matchedSkills,
      explanation: match.explanation,
      resumeId: resume._id,
      jobId: job._id
    });
  } catch (error) {
    next(error);
  }
};


