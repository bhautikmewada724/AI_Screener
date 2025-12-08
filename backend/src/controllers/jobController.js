import JobDescription from '../models/JobDescription.js';
import Resume from '../models/Resume.js';
import MatchResult from '../models/MatchResult.js';
import { parseJobDescription } from '../services/aiService.js';
import { ensureMatchResult } from '../services/hrWorkflowService.js';
import { transformAiJdToJobFields } from '../services/aiTransformers.js';

const shouldAutoParseJd = () => String(process.env.ENABLE_JD_PARSING).toLowerCase() === 'true';

const applyAiJobFields = (target, aiFields = {}) => {
  if (!aiFields) return;

  if (!target.requiredSkills?.length && aiFields.requiredSkills?.length) {
    target.requiredSkills = aiFields.requiredSkills;
  }

  if (!target.niceToHaveSkills?.length && aiFields.niceToHaveSkills?.length) {
    target.niceToHaveSkills = aiFields.niceToHaveSkills;
  }

  if (aiFields.metadata && Object.keys(aiFields.metadata).length) {
    const current =
      typeof target.metadata?.toObject === 'function'
        ? target.metadata.toObject()
        : { ...(target.metadata || {}) };
    target.metadata = { ...current, ...aiFields.metadata };
  }
};

const maybeParseJobDescription = async ({ title, description, location }) => {
  if (!shouldAutoParseJd() || !description) {
    return null;
  }

  try {
    const aiResponse = await parseJobDescription({
      job_title: title,
      job_description: description,
      location
    });
    return transformAiJdToJobFields(aiResponse);
  } catch (error) {
    console.warn('JD parsing failed:', error.message);
    return null;
  }
};

const ensureOwnerOrAdmin = (job, user) => {
  if (user.role === 'admin') return;
  if (job.hrId.toString() !== user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
};

export const createJob = async (req, res, next) => {
  try {
    const {
      title,
      description,
      location,
      employmentType,
      salaryRange,
      requiredSkills = [],
      embeddings = [],
      status,
      openings,
      tags = [],
      reviewStages,
      niceToHaveSkills = []
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const hrId = req.user.role === 'admin' && req.body.hrId ? req.body.hrId : req.user.id;

    const jobPayload = {
      hrId,
      title,
      description,
      location,
      employmentType,
      salaryRange,
      requiredSkills,
      niceToHaveSkills,
      embeddings,
      status,
      openings,
      tags,
      reviewStages
    };

    if (shouldAutoParseJd()) {
      const aiFields = await maybeParseJobDescription({ title, description, location });
      applyAiJobFields(jobPayload, aiFields);
    }

    const job = await JobDescription.create(jobPayload);

    return res.status(201).json(job);
  } catch (error) {
    next(error);
  }
};

export const listJobs = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const search = req.query.search || '';

    const query = {};

    if (req.user.role === 'hr') {
      query.hrId = req.user.id;
    } else if (req.user.role === 'admin' && req.query.hrId) {
      query.hrId = req.query.hrId;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const [jobs, total] = await Promise.all([
      JobDescription.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      JobDescription.countDocuments(query)
    ]);

    return res.json({
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getJobById = async (req, res, next) => {
  try {
    const job = await JobDescription.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    ensureOwnerOrAdmin(job, req.user);
    return res.json(job);
  } catch (error) {
    next(error);
  }
};

export const updateJob = async (req, res, next) => {
  try {
    const job = await JobDescription.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    ensureOwnerOrAdmin(job, req.user);

    const updatableFields = [
      'title',
      'description',
      'location',
      'employmentType',
      'salaryRange',
      'requiredSkills',
      'niceToHaveSkills',
      'embeddings',
      'status',
      'openings',
      'tags',
      'reviewStages'
    ];

    updatableFields.forEach((field) => {
      if (typeof req.body[field] !== 'undefined') {
        job[field] = req.body[field];
      }
    });

    if (req.user.role === 'admin' && typeof req.body.hrId !== 'undefined') {
      job.hrId = req.body.hrId;
    }

    if (
      shouldAutoParseJd() &&
      Object.prototype.hasOwnProperty.call(req.body, 'description') &&
      typeof job.description === 'string' &&
      job.description.trim()
    ) {
      const aiFields = await maybeParseJobDescription({
        title: job.title,
        description: job.description,
        location: job.location
      });
      applyAiJobFields(job, aiFields);
    }

    await job.save();
    return res.json(job);
  } catch (error) {
    next(error);
  }
};

export const deleteJob = async (req, res, next) => {
  try {
    const job = await JobDescription.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    ensureOwnerOrAdmin(job, req.user);

    await Promise.all([
      MatchResult.deleteMany({ jobId: job._id }),
      job.deleteOne()
    ]);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getJobMatches = async (req, res, next) => {
  try {
    const job = await JobDescription.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    ensureOwnerOrAdmin(job, req.user);

    const minScore = Number(req.query.minScore) || 0;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const refreshScores = req.query.refresh === 'true';
    const resumes = await Resume.find({ status: 'parsed' }).sort({ createdAt: -1 });
    const matches = [];

    for (const resume of resumes) {
      let match;
      try {
        match = await ensureMatchResult({ job, resume, forceRefresh: refreshScores });
      } catch (error) {
        console.error('Failed to generate match:', error.message);
        continue;
      }

      if (match.matchScore >= minScore) {
        matches.push({
          match,
          resume
        });
      }
    }

    const sorted = matches.sort((a, b) => b.match.matchScore - a.match.matchScore);
    const paged = sorted.slice((page - 1) * limit, page * limit);

    return res.json({
      data: paged.map(({ match, resume }) => ({
        matchId: match._id,
        resumeId: resume._id,
        candidateId: resume.userId,
        matchScore: match.matchScore,
        matchedSkills: match.matchedSkills,
        explanation: match.explanation,
        missingSkills: match.missingSkills,
        embeddingSimilarity: match.embeddingSimilarity,
        resumeSummary: resume.parsedData?.summary,
        resumeSkills: resume.parsedData?.skills
      })),
      pagination: {
        total: sorted.length,
        page,
        limit,
        pages: Math.ceil(sorted.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

