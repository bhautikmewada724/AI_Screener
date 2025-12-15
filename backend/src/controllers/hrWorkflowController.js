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
import { assertValidTransition, APPLICATION_STATUSES } from '../services/applicationStatusRules.js';
import { emitNotification } from '../services/notificationService.js';

/**
 * HR-specific workflow endpoints: queues, scoring, comments, and audit trail.
 */

export const getJobReviewQueue = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const job = await fetchJobWithOwnership(req.params.jobId, req.user);

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

    return res.json({
      data: applications,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit)
      }
    });
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

    // Notify candidate about status change (idempotent per application + status)
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const deepLink = `${appBaseUrl}/candidate/applications`;
    emitNotification({
      type: 'application.status_changed',
      userId: application.candidateId?.toString?.(),
      payload: {
        title: 'Application status updated',
        body: `Your application status is now "${status.replace('_', ' ')}".`,
        data: {
          applicationId: application._id?.toString?.(),
          jobId: job._id?.toString?.(),
          status,
          deepLink
        },
        deepLink
      },
      channels: { inApp: true, email: true },
      idempotencyKey: `application-status:${application._id}:${status}`
    }).catch((err) => console.error('Failed to emit notification:', err.message));

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

    // Notify the opposite party (candidate vs HR) about the new shared comment.
    const isShared = visibility !== 'private';
    const recipients = new Set();

    if (isShared && (req.user.role === 'hr' || req.user.role === 'admin')) {
      if (application?.candidateId?.toString) {
        recipients.add(application.candidateId.toString());
      }
    }

    if (isShared && req.user.role === 'candidate') {
      // Notify job owner and assigned reviewer, excluding the author.
      if (job?.hrId?.toString) {
        recipients.add(job.hrId.toString());
      }
      if (application?.assignedTo?.toString) {
        recipients.add(application.assignedTo.toString());
      }
    }

    recipients.delete(req.user.id?.toString?.());

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const candidateDeepLink = `${appBaseUrl}/candidate/applications`;
    const hrDeepLink = `${appBaseUrl}/hr/jobs/${job?._id?.toString?.()}`;

    for (const userId of recipients) {
      const deepLink = req.user.role === 'candidate' ? hrDeepLink : candidateDeepLink;
      emitNotification({
        type: 'application.comment_added',
        userId,
        payload: {
          title: 'New comment on application',
          body,
          data: {
            applicationId: application?._id?.toString?.(),
            jobId: job?._id?.toString?.(),
            noteId: note?._id?.toString?.(),
            visibility,
            deepLink
          },
          deepLink
        },
        channels: { inApp: true, email: true },
        idempotencyKey: `application.comment:${note?._id?.toString?.()}:${userId}`
      }).catch((err) => console.error('Failed to emit comment notification:', err.message));
    }

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
      explanation: matchResult.explanation
    });
  } catch (error) {
    next(error);
  }
};


