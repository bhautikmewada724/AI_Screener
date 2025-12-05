import dotenv from 'dotenv';

dotenv.config();

const defaultWeights = {
  skill: Number(process.env.MATCH_WEIGHT_SKILL ?? 0.5),
  experience: Number(process.env.MATCH_WEIGHT_EXPERIENCE ?? 0.3),
  location: Number(process.env.MATCH_WEIGHT_LOCATION ?? 0.1),
  tag: Number(process.env.MATCH_WEIGHT_TAG ?? 0.1)
};

export const getWeights = () => {
  const total = defaultWeights.skill + defaultWeights.experience + defaultWeights.location + defaultWeights.tag;
  return {
    skill: defaultWeights.skill / total,
    experience: defaultWeights.experience / total,
    location: defaultWeights.location / total,
    tag: defaultWeights.tag / total
  };
};

export const normalizeScore = (value, max = 1) => Math.max(0, Math.min(value, max));

export const computeSkillScore = ({ jobSkills = [], resumeSkills = [] }) => {
  if (!jobSkills.length || !resumeSkills.length) return { score: 0, matched: [], missing: jobSkills };
  const matched = jobSkills.filter((skill) => resumeSkills.some((candidateSkill) => candidateSkill.toLowerCase() === skill.toLowerCase()));
  const missing = jobSkills.filter((skill) => !matched.includes(skill));
  const score = matched.length / jobSkills.length;
  return { score, matched, missing };
};

export const computeExperienceScore = ({ jobRequirements = [], resumeExperience = [] }) => {
  if (!jobRequirements.length || !resumeExperience.length) {
    return { score: 0, summary: 'Insufficient experience data.' };
  }

  const yearsFromResume = resumeExperience.reduce((acc, experience) => {
    if (!experience.startDate) return acc;
    const start = new Date(experience.startDate);
    const end = experience.endDate ? new Date(experience.endDate) : new Date();
    const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return acc + Math.max(years, 0);
  }, 0);

  const estimatedRequiredYears = jobRequirements.length * 1.5; // simple heuristic
  const score = normalizeScore(yearsFromResume / estimatedRequiredYears);
  const summary = `${yearsFromResume.toFixed(1)} yrs vs ~${estimatedRequiredYears.toFixed(1)} yrs expected`;

  return { score, summary };
};

export const computeLocationScore = ({ jobLocation, resumeLocation }) => {
  if (!jobLocation) return { score: 1, summary: 'No location preference' };
  if (!resumeLocation) return { score: 0.5, summary: 'Candidate location unknown' };

  const match = jobLocation.trim().toLowerCase() === resumeLocation.trim().toLowerCase();
  return {
    score: match ? 1 : 0.25,
    summary: match ? 'Location match' : `Prefers ${jobLocation}, candidate in ${resumeLocation}`
  };
};

export const computeTagScore = ({ jobTags = [], candidateTags = [] }) => {
  if (!jobTags.length || !candidateTags.length) return { score: 0 };
  const overlap = jobTags.filter((tag) => candidateTags.includes(tag));
  return { score: overlap.length / jobTags.length, matched: overlap };
};

export const buildExplanation = ({ skill, experience, location, tag }) => {
  return {
    matchedSkills: skill.matched,
    missingSkills: skill.missing,
    experienceSummary: experience.summary,
    locationSummary: location.summary,
    tagMatches: tag.matched || [],
    notes: [
      skill.matched.length ? `Skill overlap in ${skill.matched.join(', ')}` : 'Skill overlap pending',
      experience.summary,
      location.summary
    ].filter(Boolean)
  };
};


