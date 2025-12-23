import { randomUUID } from 'crypto';

import Application from '../models/Application.js';
import AuditEvent from '../models/AuditEvent.js';
import JobDescription from '../models/JobDescription.js';
import MatchResult from '../models/MatchResult.js';
import Resume from '../models/Resume.js';
import ReviewNote from '../models/ReviewNote.js';
import { matchResumeToJob } from './aiService.js';
import { mergeWithDefaults } from './scoringConfig.js';
import { getEffectiveParsedData } from './resumeCorrectionService.js';

/**
 * Shared helpers for HR workflow controllers to avoid duplicating ownership checks
 * and AI scoring orchestration.
 */
export const isTraceEnabled = () => String(process.env.TRACE_MATCHING || '').toLowerCase() === 'true';

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

const pickField = (aiResponse, snake, camel, fallback = undefined) => {
  if (typeof aiResponse[snake] !== 'undefined' && aiResponse[snake] !== null) {
    return aiResponse[snake];
  }
  if (typeof aiResponse[camel] !== 'undefined' && aiResponse[camel] !== null) {
    return aiResponse[camel];
  }
  return fallback;
};

export const normalizeAiMatchResponse = (aiResponse = {}) => {
  const matchScore = pickField(aiResponse, 'match_score', 'matchScore', 0);
  const matchedSkills = pickField(aiResponse, 'matched_skills', 'matchedSkills', []) || [];
  const missingSkills = pickField(aiResponse, 'missing_critical_skills', 'missingCriticalSkills', []) || [];
  const embeddingSimilarity = pickField(aiResponse, 'embedding_similarity', 'embeddingSimilarity', 0);
  const scoreBreakdown = pickField(aiResponse, 'score_breakdown', 'scoreBreakdown', null);
  const scoringConfigVersion = pickField(aiResponse, 'scoring_config_version', 'scoringConfigVersion', null);
  const missingMustHaveSkills = pickField(aiResponse, 'missing_must_have_skills', 'missingMustHaveSkills', []);
  const missingNiceToHaveSkills = pickField(
    aiResponse,
    'missing_nice_to_have_skills',
    'missingNiceToHaveSkills',
    []
  );
  const explainability = pickField(aiResponse, 'explanation', 'explanation', {}) || {};
  const trace = pickField(aiResponse, 'trace', 'trace', null);

  let explanation = explainability;
  if (!explanation || typeof explanation !== 'object') {
    explanation = {};
  } else {
    explanation = { ...explanation };
  }

  if (!explanation.notes && aiResponse.notes) {
    explanation.notes = aiResponse.notes;
  }
  if (!explanation.missingSkills) {
    explanation.missingSkills = missingSkills;
  }
  if (typeof explanation.embeddingSimilarity === 'undefined') {
    explanation.embeddingSimilarity = embeddingSimilarity;
  }
  if (!explanation.source) {
    explanation.source = 'ai-service';
  }
  if (!explanation.missingMustHaveSkills && Array.isArray(missingMustHaveSkills)) {
    explanation.missingMustHaveSkills = missingMustHaveSkills;
  }
  if (!explanation.missingNiceToHaveSkills && Array.isArray(missingNiceToHaveSkills)) {
    explanation.missingNiceToHaveSkills = missingNiceToHaveSkills;
  }

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    embeddingSimilarity,
    explanation,
    scoreBreakdown,
    scoringConfigVersion,
    trace
  };
};

export const ensureMatchResult = async ({ job, resume, forceRefresh = false, requestId: incomingRequestId }) => {
  const tracingEnabled = isTraceEnabled();
  const requestId = incomingRequestId || randomUUID();
  if (tracingEnabled) {
    console.log('[TRACE] backend received apply request', {
      requestId,
      jobId: job?._id,
      resumeId: resume?._id
    });
  }

  if (!forceRefresh) {
    const existing = await MatchResult.findOne({
      jobId: job._id,
      resumeId: resume._id
    });
    if (existing) {
      if (!existing.candidateId && resume?.userId) {
        existing.candidateId = resume.userId;
        await existing.save();
      }
      if (tracingEnabled) {
        console.log('[TRACE] cache hit -> returning existing MatchResult', {
          requestId,
          jobId: job._id,
          resumeId: resume._id,
          matchScore: existing.matchScore
        });
      }
      return existing;
    }
  }

  const scoringConfig = mergeWithDefaults(job.scoringConfig || {});
  const parsedData = getEffectiveParsedData(resume);
  const resumeSkills = Array.isArray(parsedData?.skills) ? parsedData.skills : [];
  const jobRequiredSkills = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
  const resumeTextParts = [];
  if (parsedData?.summary) resumeTextParts.push(parsedData.summary);
  if (resumeSkills.length) resumeTextParts.push(resumeSkills.join(', '));
  if (Array.isArray(parsedData?.experience)) {
    const expSummaries = parsedData.experience
      .map((item) => [item.role, item.company, item.duration].filter(Boolean).join(' '))
      .filter(Boolean);
    if (expSummaries.length) resumeTextParts.push(expSummaries.join(' | '));
  }
  if (Array.isArray(parsedData?.education)) {
    const eduSummaries = parsedData.education
      .map((item) => [item.institution, item.degree, item.graduationYear].filter(Boolean).join(' '))
      .filter(Boolean);
    if (eduSummaries.length) resumeTextParts.push(eduSummaries.join(' | '));
  }
  const resumeText = resumeTextParts.filter(Boolean).join(' · ').trim();
  if (tracingEnabled) {
    console.log('[TRACE] scoring with parsedData', {
      requestId,
      jobId: job._id,
      resumeId: resume._id,
      resumeSkills: resumeSkills,
      jobRequiredSkills,
      resumeSkillsCount: resumeSkills.length,
      resumeSummaryLength: parsedData?.summary ? parsedData.summary.length : 0,
      resumeTextLength: resumeText.length,
      includeTrace: tracingEnabled,
      payloadKeys: ['resume_skills', 'job_required_skills', 'resume_summary', 'job_summary', 'scoring_config', 'scoring_config_version', 'include_trace']
    });
  }
  const aiResponse = await matchResumeToJob({
    resume_skills: resumeSkills,
    job_required_skills: jobRequiredSkills,
    resume_summary: parsedData?.summary,
    resume_text: resumeText || undefined,
    job_summary: job.description,
    scoring_config: scoringConfig,
    scoring_config_version: job.scoringConfigVersion ?? scoringConfig.version ?? 0,
    include_trace: tracingEnabled
  }, { headers: { 'X-Request-Id': requestId } });
  if (tracingEnabled) {
    console.log('[TRACE] ai-service match response received', {
      requestId,
      hasTrace: Boolean(aiResponse?.trace),
      traceExtractionLength: aiResponse?.trace?.extraction?.resumeTextLength,
      requiredSkillsMatchedCount: aiResponse?.trace?.skills?.requiredSkillsMatchedCount,
      matchedSkillsCount: Array.isArray(aiResponse?.matched_skills) ? aiResponse.matched_skills.length : 0
    });
  }

  const normalized = normalizeAiMatchResponse(aiResponse);
  const scoringConfigVersion =
    normalized.scoringConfigVersion ??
    job.scoringConfigVersion ??
    scoringConfig.version ??
    0;

  const backendTrace = tracingEnabled
    ? {
        requestId,
        timestamp: new Date().toISOString(),
        jobId: job._id,
        applicationId: null,
        warnings: [],
        fallbackUsed: false,
        environment: process.env.NODE_ENV || 'development'
      }
    : null;

  const mergedTrace =
    tracingEnabled && (normalized.trace || backendTrace)
      ? { backend: backendTrace, aiService: normalized.trace || null }
      : undefined;

  const update = {
    $set: {
      candidateId: resume.userId || resume.owner,
      matchScore: normalized.matchScore,
      matchedSkills: normalized.matchedSkills,
      missingSkills: normalized.missingSkills,
      embeddingSimilarity: normalized.embeddingSimilarity,
      explanation: normalized.explanation,
      scoreBreakdown: normalized.scoreBreakdown,
      scoringConfigVersion,
      trace: tracingEnabled ? mergedTrace : undefined
    }
  };

  if (!tracingEnabled) {
    update.$unset = { trace: '' };
  }

  const matchResult = await MatchResult.findOneAndUpdate(
    {
      jobId: job._id,
      resumeId: resume._id
    },
    update,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (tracingEnabled) {
    if (normalized.trace?.aiService || normalized.trace) {
      const extraction = normalized.trace?.aiService?.extraction || normalized.trace?.extraction || {};
      const skills = normalized.trace?.aiService?.skills || normalized.trace?.skills || {};
      console.log('[TRACE][AI-SERVICE]', {
        requestId,
        resumeTextLength: extraction.resumeTextLength,
        extractionWarnings: extraction.extractionWarnings,
        requiredSkillsMatchedCount: skills.requiredSkillsMatchedCount,
        requiredSkillsTotal: skills.requiredSkillsTotal
      });
    } else {
      console.log('[TRACE] ai-service trace not provided', {
        requestId,
        jobId: job._id,
        resumeId: resume._id
      });
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

  const matchResult = await ensureMatchResult({ job, resume, forceRefresh: true });

  application.matchResultId = matchResult._id;
  application.matchScore = matchResult.matchScore;
  application.matchedSkills = matchResult.matchedSkills;
  application.matchExplanation = matchResult.explanation;
  application.scoreBreakdown = matchResult.scoreBreakdown;
  application.scoringConfigVersion = matchResult.scoringConfigVersion;
  await application.save();

  return { application, matchResult };
};

export const recordAuditEvent = async ({ applicationId, actorId, action, context = {}, orgId }) => {
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

export const buildQueueQuery = ({ jobId, status, orgId }) => {
  const query = { jobId };
  if (status) {
    query.status = status;
  }
  return query;
};

const clampLimit = (value, { min = 1, max = 50, fallback = 10 } = {}) => {
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return fallback;
  return Math.min(Math.max(asNumber, min), max);
};

const toStringId = (value) => (typeof value === 'string' ? value : value?.toString?.());

export const recomputeMatchesForJob = async ({ job, limit = 200 }) => {
  const cappedLimit = clampLimit(limit, { min: 1, max: 500, fallback: 200 });
  const resumes = await Resume.find({ status: 'parsed' }).sort({ createdAt: -1 }).limit(cappedLimit);

  let recomputedCount = 0;
  const failed = [];

  for (const resume of resumes) {
    try {
      await ensureMatchResult({ job, resume, forceRefresh: true });
      recomputedCount += 1;
    } catch (error) {
      console.error('Failed to recompute match result', {
        jobId: job._id,
        resumeId: resume._id,
        error: error.message
      });
      failed.push(String(resume._id));
    }
  }

  return { recomputedCount, failedCount: failed.length, failedResumeIds: failed };
};

export const getJobCandidates = async ({ job, minScore = 0, limit = 10, refresh = false }) => {
  const safeLimit = clampLimit(limit, { min: 1, max: 50, fallback: 10 });
  const safeMinScore = Number(minScore) || 0;
  const tracingEnabled = isTraceEnabled();

  const applications = await Application.find({ jobId: job._id })
    .sort({ matchScore: -1, createdAt: 1 })
    .populate('candidateId', 'name email role')
    .populate('resumeId', 'parsedData parsedDataCorrected isCorrected correctedAt status originalFileName');

  const appliedCandidateIds = new Set(
    applications.map((app) => toStringId(app.candidateId?._id || app.candidateId)).filter(Boolean)
  );

  if (refresh) {
    await recomputeMatchesForJob({ job });
  }

  const matchResults = await MatchResult.find({
    jobId: job._id,
    matchScore: { $gte: safeMinScore }
  });

  const resumeIds = matchResults.map((match) => match.resumeId).filter(Boolean);
  const resumes = await Resume.find({ _id: { $in: resumeIds } }).select(
    'userId parsedData parsedDataCorrected isCorrected correctedAt status originalFileName createdAt'
  );
  const resumeById = new Map(resumes.map((resume) => [toStringId(resume._id), resume]));

  const bestByCandidate = new Map();

  for (const match of matchResults) {
    const resume = resumeById.get(toStringId(match.resumeId));
    const candidateId = toStringId(match.candidateId || resume?.userId);
    if (!candidateId || appliedCandidateIds.has(candidateId)) {
      continue;
    }

    const existing = bestByCandidate.get(candidateId);
    if (!existing || match.matchScore > existing.match.matchScore) {
      bestByCandidate.set(candidateId, { match, resume });
    }
  }

  const suggested = Array.from(bestByCandidate.values())
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, safeLimit)
    .map(({ match, resume }) => {
      const candidateId = toStringId(match.candidateId || resume?.userId);
      const resumeId = toStringId(match.resumeId);
      const parsedData = getEffectiveParsedData(resume);
      return {
        matchId: match._id,
        resumeId,
        candidateId,
        matchScore: match.matchScore,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        embeddingSimilarity: match.embeddingSimilarity,
        explanation: match.explanation,
        scoreBreakdown: match.scoreBreakdown,
        scoringConfigVersion: match.scoringConfigVersion,
        resumeSummary: parsedData?.summary,
        resumeSkills: parsedData?.skills,
        trace: tracingEnabled ? match.trace : undefined,
        applied: false
      };
    });

  const mergedConfig = mergeWithDefaults(job.scoringConfig || {});
  const version = job.scoringConfigVersion ?? mergedConfig.version ?? 0;

  return {
    jobId: job._id,
    config: {
      version,
      source: 'job.scoringConfig'
    },
    applied: applications,
    suggested
  };
};


