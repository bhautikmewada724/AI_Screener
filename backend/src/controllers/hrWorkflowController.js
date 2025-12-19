import Application from '../models/Application.js';
import AuditEvent from '../models/AuditEvent.js';
import ReviewNote from '../models/ReviewNote.js';
import Resume from '../models/Resume.js';
import {
  buildQueueQuery,
  createReviewNote,
  ensureMatchResult,
  fetchApplicationWithJob,
  fetchJobWithOwnership,
  recordAuditEvent,
  refreshApplicationMatch
} from '../services/hrWorkflowService.js';
import { assertValidTransition } from '../services/applicationStatusRules.js';

/**
 * HR-specific workflow endpoints: queues, scoring, comments, and audit trail.
 */

const fetchApplicationsForJob = async ({ job, status, page = 1, limit = 20 }) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const query = buildQueueQuery({ jobId: job._id, status });
  const [applications, total] = await Promise.all([
    Application.find(query)
      .sort({ matchScore: -1, createdAt: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('candidateId', 'name email role')
      .populate('resumeId', 'parsedData status originalFileName'),
    Application.countDocuments(query)
  ]);

  return {
    applications,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit)
    }
  };
};

export const getJobReviewQueue = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const job = await fetchJobWithOwnership(req.params.jobId, req.user);
    const { applications, pagination } = await fetchApplicationsForJob({ job, status, page, limit });

    return res.json({ data: applications, pagination });
  } catch (error) {
    next(error);
  }
};

export const getJobApplications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const job = await fetchJobWithOwnership(req.params.jobId, req.user);
    const { applications, pagination } = await fetchApplicationsForJob({ job, status, page, limit });

    return res.json({ data: applications, pagination });
  } catch (error) {
    next(error);
  }
};

export const getApplicationDetails = async (req, res, next) => {
  try {
    const { application } = await fetchApplicationWithJob(req.params.applicationId, req.user);
    await application.populate('candidateId jobId resumeId');
    return res.json({ application });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, reviewStage, decisionReason } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    const { application, job } = await fetchApplicationWithJob(req.params.applicationId, req.user);
    const previousStatus = application.status;

    try {
      assertValidTransition(previousStatus, status);
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }

    application.status = status;

    if (reviewStage) {
      application.reviewStage = reviewStage;
    }

    if (decisionReason) {
      application.decisionReason = decisionReason;
    }

    await application.save();

    await recordAuditEvent({
      applicationId: application._id,
      actorId: req.user.id,
      action: 'status_changed',
      context: {
        jobId: job._id,
        previousStatus,
        newStatus: status,
        actorRole: req.user.role,
        applicationId: application._id,
        reviewStage: reviewStage || application.reviewStage
      }
    });

    return res.json({ application });
  } catch (error) {
    next(error);
  }
};

export const refreshScore = async (req, res, next) => {
  try {
    const { application } = await fetchApplicationWithJob(req.params.applicationId, req.user);
    const { application: updatedApplication } = await refreshApplicationMatch(application);

    await recordAuditEvent({
      applicationId: application._id,
      actorId: req.user.id,
      action: 'score_refreshed'
    });

    return res.json({ application: updatedApplication });
  } catch (error) {
    next(error);
  }
};

export const listComments = async (req, res, next) => {
  try {
    await fetchApplicationWithJob(req.params.applicationId, req.user);
    const notes = await ReviewNote.find({ applicationId: req.params.applicationId })
      .sort({ createdAt: -1 })
      .populate('authorId', 'name email role');

    return res.json({ data: notes });
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { body, visibility = 'shared' } = req.body || {};
    if (!body) {
      return res.status(400).json({ message: 'Comment body is required.' });
    }

    const { application, job } = await fetchApplicationWithJob(req.params.applicationId, req.user);
    const note = await createReviewNote({
      applicationId: req.params.applicationId,
      authorId: req.user.id,
      body,
      visibility
    });

    return res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
};

export const listAuditTrail = async (req, res, next) => {
  try {
    await fetchApplicationWithJob(req.params.applicationId, req.user);
    const events = await AuditEvent.find({ applicationId: req.params.applicationId })
      .sort({ createdAt: -1 })
      .populate('actorId', 'name email role');

    return res.json({ data: events });
  } catch (error) {
    next(error);
  }
};

export const getScorePreview = async (req, res, next) => {
  try {
    const { resumeId } = req.body || {};
    if (!resumeId) {
      return res.status(400).json({ message: 'resumeId is required.' });
    }

    const job = await fetchJobWithOwnership(req.params.jobId, req.user);
    const resume = await Resume.findById(resumeId);

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found.' });
    }

    const matchResult = await ensureMatchResult({ job, resume });

    return res.json({
      jobId: job._id,
      resumeId,
      matchScore: matchResult.matchScore,
      matchedSkills: matchResult.matchedSkills,
      explanation: matchResult.explanation,
      scoreBreakdown: matchResult.scoreBreakdown,
      scoringConfigVersion: matchResult.scoringConfigVersion
    });
  } catch (error) {
    next(error);
  }
};

export const getJobSuggestions = async (req, res, next) => {
  try {
    const { minScore = 0, limit = 10 } = req.query;
    const refresh = req.query.refresh === 'true';
    const job = await fetchJobWithOwnership(req.params.jobId, req.user);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const appliedCandidates = new Set(
      (
        await Application.find({ jobId: job._id })
          .select('candidateId')
          .lean()
      ).map((app) => String(app.candidateId))
    );

    const resumes = await Resume.find({ status: 'parsed' }).sort({ createdAt: -1 });
    const matches = [];

    for (const resume of resumes) {
      if (appliedCandidates.has(String(resume.userId))) {
        continue;
      }

      try {
        const match = await ensureMatchResult({ job, resume, forceRefresh: refresh });
        if (match.matchScore >= Number(minScore)) {
          matches.push({ match, resume });
        }
      } catch (error) {
        console.error('Failed to score candidate for suggestions:', error.message);
      }
    }

    const sorted = matches.sort((a, b) => b.match.matchScore - a.match.matchScore).slice(0, safeLimit);

    return res.json({
      data: sorted.map(({ match, resume }) => ({
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
        resumeSkills: resume.parsedData?.skills,
        applied: false
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const addCandidateToJob = async (req, res, next) => {
  try {
    const { candidateId, resumeId } = req.body || {};
    if (!candidateId || !resumeId) {
      return res.status(400).json({ message: 'candidateId and resumeId are required.' });
    }

    const job = await fetchJobWithOwnership(req.params.jobId, req.user);
    if (job.status && job.status !== 'open') {
      return res.status(400).json({ message: 'Job is not accepting applications.' });
    }

    const [resume, existing] = await Promise.all([
      Resume.findById(resumeId),
      Application.findOne({ jobId: job._id, candidateId })
    ]);

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found.' });
    }

    if (String(resume.userId) !== String(candidateId)) {
      return res.status(400).json({ message: 'Resume does not belong to the candidate.' });
    }

    if (resume.status !== 'parsed') {
      return res.status(400).json({ message: 'Resume is not ready for scoring.' });
    }

    if (existing) {
      return res.status(409).json({ message: 'Candidate already has an application for this job.' });
    }

    const matchResult = await ensureMatchResult({ job, resume, forceRefresh: true });

    const application = await Application.create({
      jobId: job._id,
      candidateId,
      resumeId,
      matchResultId: matchResult._id,
      matchScore: matchResult.matchScore,
      matchedSkills: matchResult.matchedSkills,
      matchExplanation: matchResult.explanation,
      scoreBreakdown: matchResult.scoreBreakdown,
      scoringConfigVersion: matchResult.scoringConfigVersion,
      status: 'applied',
      source: 'hr_sourced'
    });

    await recordAuditEvent({
      applicationId: application._id,
      actorId: req.user.id,
      action: 'application_created',
      context: {
        jobId: job._id,
        source: 'hr_sourced',
        candidateId
      }
    });

    return res.status(201).json({ application });
  } catch (error) {
    next(error);
  }
};


