import JobDescription from '../models/JobDescription.js';
import Resume from '../models/Resume.js';
import MatchResult from '../models/MatchResult.js';
import { matchResumeToJob } from '../services/aiService.js';

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
      reviewStages
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const hrId = req.user.role === 'admin' && req.body.hrId ? req.body.hrId : req.user.id;

    const job = await JobDescription.create({
      hrId,
      title,
      description,
      location,
      employmentType,
      salaryRange,
      requiredSkills,
      embeddings,
      status,
      openings,
      tags,
      reviewStages
    });

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

    const resumes = await Resume.find({ status: 'parsed' }).sort({ createdAt: -1 });
    const matches = [];

    for (const resume of resumes) {
      let match = await MatchResult.findOne({
        resumeId: resume._id,
        jobId: job._id
      });

      if (!match) {
        try {
          const aiResponse = await matchResumeToJob({
            resume_skills: resume.parsedData?.skills || [],
            job_required_skills: job.requiredSkills || [],
            resume_summary: resume.parsedData?.summary,
            job_summary: job.description
          });

          try {
            match = await MatchResult.create({
            resumeId: resume._id,
            jobId: job._id,
            matchScore: aiResponse.match_score ?? aiResponse.matchScore ?? 0,
            matchedSkills: aiResponse.matched_skills ?? aiResponse.matchedSkills ?? [],
            explanation: aiResponse.notes || 'Match generated via AI service.'
            });
          } catch (creationError) {
            if (creationError.code === 11000) {
              match = await MatchResult.findOne({
                resumeId: resume._id,
                jobId: job._id
              });
            } else {
              throw creationError;
            }
          }
        } catch (error) {
          console.error('Failed to generate match:', error.message);
          continue;
        }
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

