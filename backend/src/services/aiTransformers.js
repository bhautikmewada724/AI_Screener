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

const CONTACT_PATTERNS = [/@[a-z0-9._-]+/i, /\b\+?\d{7,}\b/, /\blinked(in)?\b/i, /\bgithub\b/i];
const EDUCATION_TERMS = [/university/i, /bachelor/i, /cgpa/i, /coursework/i, /college/i, /institute/i, /school/i];

const looksLikeContactOrEducation = (value = '') => {
  if (!value) return false;
  return CONTACT_PATTERNS.some((re) => re.test(value)) || EDUCATION_TERMS.some((re) => re.test(value));
};

const VERB_LINE = /^(developed|designed|built|implemented|created|validation|and|reduced|collaborated|integrated|contributed|optimized|added|deployed|got|mentored|designed)/i;

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  sept: '09',
  oct: '10',
  nov: '11',
  dec: '12'
};

const parseMonthYear = (token) => {
  if (!token) return null;
  const match = token.trim().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*([0-9]{4})/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()] || '01';
    return `${match[2]}-${month}-01`;
  }
  const yearMatch = token.trim().match(/(19|20)\d{2}/);
  if (yearMatch) {
    return `${yearMatch[0]}-01-01`;
  }
  return null;
};

const extractDatesFromString = (value = '') => {
  // supports ranges like "Sep – Nov 2025" or "Sep 2024 - Dec 2025"
  const rangeMatch = value.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*[0-9]{4}[^0-9A-Za-z]+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?[\s.]*(\d{4})?/i
  );
  if (rangeMatch) {
    const startToken = rangeMatch[0]
      .split(/[-–—to]+/i)[0]
      .trim();
    const endToken = rangeMatch[0]
      .split(/[-–—to]+/i)[1]
      ?.trim();
    const startDate = parseMonthYear(startToken);
    const endDate = parseMonthYear(endToken || rangeMatch[2] ? `${rangeMatch[2]} ${rangeMatch[3] || ''}` : endToken);
    return { startDate, endDate, durationText: rangeMatch[0] };
  }
  return { startDate: null, endDate: null, durationText: null };
};

const parseDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const pickFirst = (obj, keys = []) => {
  for (const key of keys) {
    if (typeof obj[key] !== 'undefined' && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
};

export const transformAiResumeToParsedData = (aiPayload = {}) => {
  const experienceSource = pickFirst(aiPayload, ['experience', 'Experience', 'work_experience', 'workExperience']) || [];
  const rawExperience = toArray(experienceSource).map((item = {}) => {
    const startDateRaw = pickFirst(item, ['startDate', 'start_date', 'start', 'from']);
    const endDateRaw = pickFirst(item, ['endDate', 'end_date', 'end', 'to']);
    const duration = pickFirst(item, ['duration', 'tenure', 'timeline']);
    const company = pickFirst(item, ['company', 'employer', 'organization']);
    const role = pickFirst(item, ['role', 'title', 'position']);
    const description = pickFirst(item, ['description', 'summary', 'highlights', 'responsibilities']);

    return {
      company: typeof company === 'string' ? company : undefined,
      role: typeof role === 'string' ? role : undefined,
      startDate: startDateRaw ? parseDate(startDateRaw) : undefined,
      endDate: endDateRaw ? parseDate(endDateRaw) : undefined,
      description: typeof duration === 'string' && duration.trim() ? duration : description || undefined
    };
  })
    .filter((entry) => (entry.company || entry.role))
    .filter((entry) => !looksLikeContactOrEducation(entry.company) && !looksLikeContactOrEducation(entry.role))
    .slice(0, 5);

  // Consolidate and enrich experience: keep only company/role/location/dates, drop bullet-only rows
  const experience = rawExperience
    .map((item) => {
      let company = item.company || '';
      let role = item.role || '';
      let startDate = item.startDate;
      let endDate = item.endDate;
      let location;
      let durationText;

      if (!startDate && !endDate) {
        const { startDate: s, endDate: e, durationText: dt } = extractDatesFromString(company);
        startDate = s ? parseDate(s) : undefined;
        endDate = e ? parseDate(e) : undefined;
        durationText = dt;
        if (dt) {
          company = company.replace(dt, '').trim().replace(/[–—-]+$/, '').trim();
        }
      }
      if (!startDate && !endDate) {
        const { startDate: s, endDate: e, durationText: dt } = extractDatesFromString(role);
        startDate = s ? parseDate(s) : undefined;
        endDate = e ? parseDate(e) : undefined;
        durationText = durationText || dt;
        if (dt) {
          role = role.replace(dt, '').trim().replace(/[–—-]+$/, '').trim();
        }
      }

      if (role && role.includes(',')) {
        const parts = role.split(',');
        location = parts.pop().trim();
        role = parts.join(',').trim();
      }
      if (!location && company && company.includes(',')) {
        const parts = company.split(',');
        location = parts.pop().trim();
        company = parts.join(',').trim();
      }

      if (!company && !role) return null;

      return {
        company: company || role || '',
        role: role || company || '',
        location,
        duration: durationText || item.description,
        description: item.description || durationText || undefined,
        startDate,
        endDate
      };
    })
    .filter((entry) => {
      if (!entry) return false;
      // Drop bullet-style sentences
      if (VERB_LINE.test(entry.company) || VERB_LINE.test(entry.role)) return false;
      return true;
    })
    .slice(0, 5);

  const educationSource = pickFirst(aiPayload, ['education', 'Education', 'academics']) || [];
  const education = toArray(educationSource).map((item = {}) => ({
    institution: item.institution || undefined,
    degree: item.degree || undefined,
    year:
      typeof item.graduation_year === 'number'
        ? item.graduation_year
        : typeof item.graduationYear === 'number'
          ? item.graduationYear
          : undefined
  }));

  const skillsSource = pickFirst(aiPayload, ['skills', 'Skills']) || [];
  const summarySource = pickFirst(aiPayload, ['summary', 'Summary']);
  const locationSource = pickFirst(aiPayload, ['location', 'Location']);

  return {
    summary: typeof summarySource === 'string' ? summarySource.trim() : undefined,
    skills: sanitizeStrings(skillsSource),
    experience,
    education,
    location: typeof locationSource === 'string' ? locationSource : undefined,
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


