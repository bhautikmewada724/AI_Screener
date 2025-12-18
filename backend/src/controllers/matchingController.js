import JobDescription from '../models/JobDescription.js';
import Resume from '../models/Resume.js';
import { ensureMatchResult } from '../services/hrWorkflowService.js';
import { scoreCandidateForJob } from '../services/matchingService.js';

export const getRankedMatches = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const minScore = Number(req.query.minScore) || 0;
    const limit = Number(req.query.limit) || 20;
    const refresh = req.query.refresh === 'true';

    const job = await JobDescription.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const resumes = await Resume.find({ status: 'parsed' }).sort({ createdAt: -1 });
    const matches = [];

    for (const resume of resumes) {
      try {
        const match = await ensureMatchResult({ job, resume, forceRefresh: refresh });
        if (match.matchScore >= minScore) {
          matches.push({
            match,
            resume
          });
        }
      } catch (error) {
        console.error('Failed to score candidate:', error.message);
      }
    }

    const sorted = matches.sort((a, b) => b.match.matchScore - a.match.matchScore).slice(0, limit);

    const payload = sorted.map(({ match, resume }) => ({
      matchId: match._id,
      resumeId: resume._id,
      candidateId: resume.userId,
      matchScore: match.matchScore,
      matchedSkills: match.matchedSkills,
      explanation: match.explanation,
      missingSkills: match.missingSkills,
      embeddingSimilarity: match.embeddingSimilarity,
      scoreBreakdown: match.scoreBreakdown,
      scoringConfigVersion: match.scoringConfigVersion,
      resumeSummary: resume.parsedData?.summary,
      resumeSkills: resume.parsedData?.skills
    }));

    res.json({ data: payload });
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

    // NOTE: This endpoint intentionally uses the local heuristic service as a sandbox.
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


