import MatchResult from '../models/MatchResult.js';

/**
 * Deterministic heuristic scoring helpers.
 * These are reserved for simulation/sandbox flows so production traffic
 * remains aligned with the FastAPI /ai/match contract.
 */
const DEFAULT_WEIGHTS = {
  skills: Number(process.env.MATCH_WEIGHT_SKILLS || 0.6),
  experience: Number(process.env.MATCH_WEIGHT_EXPERIENCE || 0.25),
  location: Number(process.env.MATCH_WEIGHT_LOCATION || 0.1),
  tags: Number(process.env.MATCH_WEIGHT_TAGS || 0.05)
};

export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const computeSkillScore = (required = [], candidate = []) => {
  const requiredSet = new Set(required.map((s) => s.toLowerCase()));
  const candidateSet = new Set(candidate.map((s) => s.toLowerCase()));

  let matched = 0;
  requiredSet.forEach((skill) => {
    if (candidateSet.has(skill)) matched += 1;
  });

  const score = requiredSet.size ? matched / requiredSet.size : candidateSet.size ? 0.5 : 0;
  const matchedSkills = required.filter((skill) => candidateSet.has(skill.toLowerCase()));
  const missingSkills = required.filter((skill) => !candidateSet.has(skill.toLowerCase()));

  return { score: clamp01(score), matchedSkills, missingSkills };
};

export const computeExperienceScore = (job, resume) => {
  const jobSeniority = job.metadata?.get?.('seniority') || job.metadata?.seniority;
  const resumeExperience = resume?.parsedData?.experience || [];
  const years = resumeExperience.reduce((total, item) => {
    if (!item.startDate || !item.endDate) return total;
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    const diffYears = (end - start) / (1000 * 60 * 60 * 24 * 365);
    return total + Math.max(diffYears, 0);
  }, 0);

  let score = 0.5;
  if (years) {
    if (jobSeniority === 'senior') score = years >= 7 ? 1 : years / 7;
    else if (jobSeniority === 'mid') score = years >= 4 ? 1 : years / 4;
    else if (jobSeniority === 'junior') score = years >= 1 ? 1 : years;
    else score = Math.min(years / 5, 1);
  }

  return { score: clamp01(score), years };
};

export const computeLocationScore = (job, resume) => {
  const jobLocation = (job.location || '').toLowerCase();
  const resumeLocation = ((resume.metadata?.location || resume.parsedData?.location || '')).toLowerCase();
  if (!jobLocation || !resumeLocation) {
    return { score: 0.5, match: 'unknown' };
  }

  const match =
    jobLocation === 'remote' || resumeLocation === 'remote' || jobLocation === resumeLocation ? 'match' : 'mismatch';

  const score = match === 'match' ? 1 : 0;
  return { score, match };
};

export const computeTagScore = (job, resume) => {
  const jobTags = job.tags || [];
  const resumeTags = resume.metadata?.tags || [];

  if (!jobTags.length || !resumeTags.length) {
    return { score: 0.5, matchedTags: [] };
  }

  const resumeSet = new Set(resumeTags.map((tag) => tag.toLowerCase()));
  const matched = jobTags.filter((tag) => resumeSet.has(tag.toLowerCase()));
  const score = matched.length / jobTags.length;

  return { score: clamp01(score), matchedTags: matched };
};

const combineScores = (scores) => {
  const totalWeight = Object.values(DEFAULT_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

  const combinedScore =
    (scores.skills.score * DEFAULT_WEIGHTS.skills +
      scores.experience.score * DEFAULT_WEIGHTS.experience +
      scores.location.score * DEFAULT_WEIGHTS.location +
      scores.tags.score * DEFAULT_WEIGHTS.tags) /
    totalWeight;

  return clamp01(combinedScore);
};

export const scoreCandidateForJob = async ({ job, resume, forceRefresh = false }) => {
  if (!job || !resume) {
    throw new Error('Job and resume are required for scoring.');
  }

  if (!forceRefresh) {
    const existingResult = await MatchResult.findOne({
      jobId: job._id,
      resumeId: resume._id
    });

    if (existingResult) {
      return existingResult;
    }
  }

  const skillFeatures = computeSkillScore(job.requiredSkills, resume.parsedData?.skills);
  const experienceFeatures = computeExperienceScore(job, resume);
  const locationFeatures = computeLocationScore(job, resume);
  const tagFeatures = computeTagScore(job, resume);

  const aggregatedScore = combineScores({
    skills: skillFeatures,
    experience: experienceFeatures,
    location: locationFeatures,
    tags: tagFeatures
  });

  const explanation = {
    matchedSkills: skillFeatures.matchedSkills,
    missingSkills: skillFeatures.missingSkills,
    experienceYears: experienceFeatures.years,
    locationMatch: locationFeatures.match,
    matchedTags: tagFeatures.matchedTags,
    weights: DEFAULT_WEIGHTS
  };

  const match = await MatchResult.findOneAndUpdate(
    {
      jobId: job._id,
      resumeId: resume._id
    },
    {
      $set: {
        matchScore: aggregatedScore,
        matchedSkills: skillFeatures.matchedSkills,
        explanation
      }
    },
    { upsert: true, new: true }
  );

  return match;
};

