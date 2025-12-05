import Application from '../models/Application.js';
import AuditEvent from '../models/AuditEvent.js';
import JobDescription from '../models/JobDescription.js';
import MatchResult from '../models/MatchResult.js';
import Resume from '../models/Resume.js';
import ReviewNote from '../models/ReviewNote.js';
import { matchResumeToJob } from './aiService.js';

/**
 * Shared helpers for HR workflow controllers to avoid duplicating ownership checks
 * and AI scoring orchestration.
 */
export const assertJobOwnership = (job, user) => {
  if (!job) {
    const notFound = new Error('Job not found.');
    notFound.status = 404;
    throw notFound;
  }

  if (user.role === 'admin') {
    return;
  }

  if (job.hrId.toString() !== user.id) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
};

export const assertApplicationOwnership = (application, job, user) => {
  if (!application) {
    const notFound = new Error('Application not found.');
    notFound.status = 404;
    throw notFound;
  }

  assertJobOwnership(job, user);
};

export const fetchJobWithOwnership = async (jobId, user) => {
  const job = await JobDescription.findById(jobId);
  assertJobOwnership(job, user);
  return job;
};

export const fetchApplicationWithJob = async (applicationId, user) => {
  const application = await Application.findById(applicationId);
  if (!application) {
    const notFound = new Error('Application not found.');
    notFound.status = 404;
    throw notFound;
  }

  const job = await JobDescription.findById(application.jobId);
  assertApplicationOwnership(application, job, user);
  return { application, job };
};

export const ensureMatchResult = async ({ job, resume }) => {
  let matchResult = await MatchResult.findOne({
    jobId: job._id,
    resumeId: resume._id
  });

  if (!matchResult) {
    const aiResponse = await matchResumeToJob({
      resume_skills: resume.parsedData?.skills || [],
      job_required_skills: job.requiredSkills || [],
      resume_summary: resume.parsedData?.summary,
      job_summary: job.description
    });

    try {
      matchResult = await MatchResult.create({
        jobId: job._id,
        resumeId: resume._id,
        matchScore: aiResponse.match_score ?? aiResponse.matchScore ?? 0,
        matchedSkills: aiResponse.matched_skills ?? aiResponse.matchedSkills ?? [],
        explanation: aiResponse.notes || 'Match generated via AI service.'
      });
    } catch (error) {
      if (error.code === 11000) {
        matchResult = await MatchResult.findOne({
          jobId: job._id,
          resumeId: resume._id
        });
      } else {
        throw error;
      }
    }
  }

  return matchResult;
};

export const refreshApplicationMatch = async (application) => {
  const [job, resume] = await Promise.all([
    JobDescription.findById(application.jobId),
    Resume.findById(application.resumeId)
  ]);

  if (!job || !resume) {
    const error = new Error('Unable to refresh score without job and resume data.');
    error.status = 400;
    throw error;
  }

  const matchResult = await ensureMatchResult({ job, resume });

  application.matchResultId = matchResult._id;
  application.matchScore = matchResult.matchScore;
  application.matchedSkills = matchResult.matchedSkills;
  application.matchExplanation = matchResult.explanation;
  await application.save();

  return { application, matchResult };
};

export const recordAuditEvent = async ({ applicationId, actorId, action, context = {} }) => {
  return AuditEvent.create({
    applicationId,
    actorId,
    action,
    context
  });
};

export const createReviewNote = async ({ applicationId, authorId, body, visibility }) => {
  const note = await ReviewNote.create({
    applicationId,
    authorId,
    body,
    visibility
  });

  await Application.findByIdAndUpdate(applicationId, { $inc: { notesCount: 1 } });
  await recordAuditEvent({
    applicationId,
    actorId: authorId,
    action: 'comment_added',
    context: { noteId: note._id }
  });

  return note;
};

export const buildQueueQuery = ({ jobId, status }) => {
  const query = { jobId };
  if (status) {
    query.status = status;
  }
  return query;
};


