/**
 * Utility helpers that normalize AI service payloads before persisting them.
 * These keep the rest of the codebase agnostic to snake_case contracts or
 * provider-specific quirks.
 */

const toArray = (value) => (Array.isArray(value) ? value : []);

const sanitizeStrings = (values = []) =>
  toArray(values)
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

const parseDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const transformAiResumeToParsedData = (aiPayload = {}) => {
  const experience = toArray(aiPayload.experience).map((item = {}) => ({
    company: item.company || undefined,
    role: item.role || undefined,
    startDate: item.startDate ? parseDate(item.startDate) : undefined,
    endDate: item.endDate ? parseDate(item.endDate) : undefined,
    description: item.duration || item.description || undefined
  }));

  const education = toArray(aiPayload.education).map((item = {}) => ({
    institution: item.institution || undefined,
    degree: item.degree || undefined,
    year:
      typeof item.graduation_year === 'number'
        ? item.graduation_year
        : typeof item.graduationYear === 'number'
          ? item.graduationYear
          : undefined
  }));

  return {
    summary: typeof aiPayload.summary === 'string' ? aiPayload.summary.trim() : undefined,
    skills: sanitizeStrings(aiPayload.skills),
    experience,
    education,
    location: typeof aiPayload.location === 'string' ? aiPayload.location : undefined,
    embeddings: toArray(aiPayload.embeddings).filter((value) => typeof value === 'number'),
    warnings: sanitizeStrings(aiPayload.warnings)
  };
};

export const transformAiJdToJobFields = (aiPayload = {}) => {
  const metadata = {};

  if (aiPayload.seniority_level || aiPayload.seniorityLevel) {
    metadata.seniorityLevel = aiPayload.seniority_level || aiPayload.seniorityLevel;
  }

  if (aiPayload.job_category || aiPayload.jobCategory) {
    metadata.jobCategory = aiPayload.job_category || aiPayload.jobCategory;
  }

  if (aiPayload.summary) {
    metadata.aiSummary = aiPayload.summary;
  }

  return {
    requiredSkills: sanitizeStrings(aiPayload.required_skills || aiPayload.requiredSkills),
    niceToHaveSkills: sanitizeStrings(aiPayload.nice_to_have_skills || aiPayload.niceToHaveSkills),
    metadata
  };
};


