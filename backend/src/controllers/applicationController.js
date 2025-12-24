import { randomUUID } from 'crypto';
import Application from '../models/Application.js';
import JobDescription from '../models/JobDescription.js';
import Recommendation from '../models/Recommendation.js';
import Resume from '../models/Resume.js';
import { parseResume as parseResumeAI } from '../services/aiService.js';
import { transformAiResumeToParsedData } from '../services/aiTransformers.js';
import * as hrWorkflowService from '../services/hrWorkflowService.js';
import * as matchingService from '../services/matchingService.js';

const deriveMatchLabel = (score = 0) => {
  if (score >= 0.75) return 'Strong';
  if (score >= 0.5) return 'Medium';
  return 'Weak';
};

/**
 * Candidate-facing application flows for submitting interest in a job.
 */
export const applyToJob = async (req, res, next) => {
  try {
    const { jobId, resumeId } = req.body || {};
    const requestId = randomUUID();
    const traceEnabled = String(process.env.TRACE_MATCHING || '').toLowerCase() === 'true';
    const clearCacheOnApply =
      String(process.env.MATCHRESULT_CLEAR_CACHE_ON_APPLY || '').toLowerCase() === 'true';

    if (traceEnabled) {
      console.log('[TRACE] applyToJob', {
        requestId,
        jobId,
        resumeId,
        userId: req.user?.id,
        TRACE_MATCHING: process.env.TRACE_MATCHING,
        MATCHRESULT_CLEAR_CACHE_ON_APPLY: process.env.MATCHRESULT_CLEAR_CACHE_ON_APPLY
      });
    }

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
      return res.status(200).json(existingApplication);
    }

    const needsReparse =
      !Array.isArray(resume.parsedData?.skills) ||
      resume.parsedData.skills.length < 5;

    if (needsReparse) {
      try {
        const aiParsed = await parseResumeAI({
          file_path: resume.filePath,
          file_name: resume.originalFileName,
          user_id: req.user.id
        });
        const transformed = transformAiResumeToParsedData(aiParsed);
        resume.parsedData = transformed;
        resume.parsedAt = new Date();
        resume.parserVersion = 'ai-service/v1';
        await resume.save();
        if (traceEnabled) {
          console.log('[TRACE] resume re-parsed before apply', {
            requestId,
            resumeId: resume._id,
            skillsCount: Array.isArray(transformed.skills) ? transformed.skills.length : 0,
            summaryLength: transformed.summary ? transformed.summary.length : 0
          });
        }
      } catch (error) {
        if (traceEnabled) {
          console.log('[TRACE] resume re-parse failed before apply', {
            requestId,
            resumeId: resume._id,
            error: error.message
          });
        }
      }
    }

    if (clearCacheOnApply) {
      if (traceEnabled) {
        console.log('[TRACE] about to clear cache before scoring', {
          requestId,
          jobId: job._id,
          resumeId: resume._id
        });
      }
      await matchingService.clearMatchResultCache({
        jobId: job._id,
        resumeId: resume._id,
        requestId
      });
    }

    if (traceEnabled && resume?._id && resumeId && String(resume._id) !== String(resumeId)) {
      console.log('[TRACE][WARN] resumeId mismatch between request and loaded resume', {
        requestId,
        requestResumeId: resumeId,
        loadedResumeId: resume._id
      });
    }

    if (traceEnabled) {
      console.log('[TRACE] scoring with job/resume', {
        requestId,
        jobId: job._id,
        resumeId: resume._id
      });
    }

    const matchResult = await hrWorkflowService.ensureMatchResult({ job, resume, requestId });
    const normalizedScore =
      typeof matchResult.matchScore === 'number' ? matchResult.matchScore : 0;
    const matchLabel = deriveMatchLabel(normalizedScore);
    const matchComputedAt = new Date();

    const application = await Application.create({
      jobId,
      candidateId: req.user.id,
      resumeId,
      matchResultId: matchResult._id,
      matchScore: normalizedScore,
      matchLabel,
      matchComputedAt,
      matchedSkills: matchResult.matchedSkills,
      matchExplanation: matchResult.explanation,
      scoreBreakdown: matchResult.scoreBreakdown,
      scoringConfigVersion: matchResult.scoringConfigVersion,
      source: 'candidate_applied'
    });

    await hrWorkflowService.recordAuditEvent({
      applicationId: application._id,
      actorId: req.user.id,
      action: 'application_submitted',
      context: { jobId },
      orgId: req.orgId || job.orgId
    });

    // Best-effort: mark any matching recommendation entry as applied
    try {
      await Recommendation.updateOne(
        { candidateId: req.user.id },
        {
          $set: { 'recommendedJobs.$[elem].status': 'applied' },
          $pull: { recommendedJobs: { jobId } }
        },
        { arrayFilters: [{ 'elem.jobId': jobId }] }
      );
    } catch (recError) {
      console.error('[WARN] failed to mark recommendation as applied', {
        candidateId: req.user.id,
        jobId,
        error: recError.message
      });
    }

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


