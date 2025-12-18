import Application from '../models/Application.js';
import JobDescription from '../models/JobDescription.js';
import Resume from '../models/Resume.js';
import { ensureMatchResult, recordAuditEvent } from '../services/hrWorkflowService.js';

/**
 * Candidate-facing application flows for submitting interest in a job.
 */
export const applyToJob = async (req, res, next) => {
  try {
    const { jobId, resumeId } = req.body || {};

    if (!jobId || !resumeId) {
      return res.status(400).json({ message: 'jobId and resumeId are required.' });
    }

    const [job, resume, existingApplication] = await Promise.all([
      JobDescription.findById(jobId),
      Resume.findOne({ _id: resumeId, userId: req.user.id }),
      Application.findOne({ jobId, candidateId: req.user.id })
    ]);

    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ message: 'Job is not accepting applications.' });
    }

    if (!resume || resume.userId.toString() !== req.user.id) {
      return res.status(400).json({ message: 'Resume not found for this user.' });
    }

    if (resume.status !== 'parsed') {
      return res.status(400).json({ message: 'Resume is still processing. Try again later.' });
    }

    if (existingApplication) {
      return res.status(409).json({ message: 'You have already applied to this job.' });
    }

    const matchResult = await ensureMatchResult({ job, resume });

    const application = await Application.create({
      jobId,
      candidateId: req.user.id,
      resumeId,
      matchResultId: matchResult._id,
      matchScore: matchResult.matchScore,
      matchedSkills: matchResult.matchedSkills,
      matchExplanation: matchResult.explanation,
      scoreBreakdown: matchResult.scoreBreakdown,
      scoringConfigVersion: matchResult.scoringConfigVersion
    });

    await recordAuditEvent({
      applicationId: application._id,
      actorId: req.user.id,
      action: 'application_submitted',
      context: { jobId },
      orgId: req.orgId || job.orgId
    });

    return res.status(201).json(application);
  } catch (error) {
    next(error);
  }
};

export const getMyApplications = async (req, res, next) => {
  try {
    const query = { candidateId: req.user.id };
    const applications = await Application.find(query)
      .populate('jobId')
      .sort({ createdAt: -1 });

    return res.json({ data: applications });
  } catch (error) {
    next(error);
  }
};


