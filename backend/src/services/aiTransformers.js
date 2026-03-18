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

const dedupeStrings = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const CONTACT_PATTERNS = [
  /@[a-z0-9._-]+/i,
  /\b\+?\d{7,}\b/,
  /\blinked(in)?\b/i,
  /\bgithub\b/i,
  /https?:\/\//i,
  /\bwww\./i
];
const EDUCATION_TERMS = [/university/i, /bachelor/i, /cgpa/i, /coursework/i, /college/i, /institute/i, /school/i];
const SECTION_HEADER_EXACT =
  /^(education|experience|skills|projects|certifications|summary|profile|objective)$/i;
const DEGREE_KEYWORDS =
  /(bachelor|master|b\.?tech|m\.?tech|mba|bca|mca|b\.?e\.?|m\.?e\.?|bsc|msc|phd|doctorate|associate|diploma)/i;
const COURSEWORK_ONLY = /(coursework|project|program|module|subject|topic|certificate|certification)/i;
const DATE_RANGE_PATTERN =
  /((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*\d{4}|\d{1,2}[/-]\d{4}|\d{4})\s*[-–—to]+\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*\d{4}|\d{1,2}[/-]\d{4}|\d{4}|present|current)/i;
const SKILL_LABELS = new Set(
  ['languages', 'tools', 'libraries', 'frameworks', 'databases', 'platforms', 'operating systems', 'skills'].map(
    (label) => label.toLowerCase()
  )
);

const looksLikeContact = (value = '') => {
  if (!value) return false;
  return CONTACT_PATTERNS.some((re) => re.test(value));
};

const looksLikeContactOrEducation = (value = '') => {
  if (!value) return false;
  return looksLikeContact(value) || EDUCATION_TERMS.some((re) => re.test(value));
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
  const cleaned = token.trim();
  const mmMatch = cleaned.match(/^(0?[1-9]|1[0-2])[/-]([0-9]{4})$/);
  if (mmMatch) {
    const month = mmMatch[1].padStart(2, '0');
    return `${mmMatch[2]}-${month}-01`;
  }
  const match = cleaned.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*([0-9]{4})/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()] || '01';
    return `${match[2]}-${month}-01`;
  }
  const yearMatch = cleaned.match(/(19|20)\d{2}/);
  if (yearMatch) {
    return `${yearMatch[0]}-01-01`;
  }
  return null;
};

const extractDatesFromString = (value = '') => {
  // supports ranges like "Sep – Nov 2025" or "Sep 2024 - Dec 2025"
  const rangeMatch = value.match(
    /((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.]*[0-9]{4}|\d{1,2}[/-]\d{4}|\d{4})[^0-9A-Za-z]+((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?[\s.]*(\d{4})?|\d{1,2}[/-]\d{4}|\d{4}|present|current)/i
  );
  if (rangeMatch) {
    const startToken = rangeMatch[0].split(/[-–—to]+/i)[0].trim();
    const endToken = rangeMatch[0].split(/[-–—to]+/i)[1]?.trim();
    const startDate = parseMonthYear(startToken);
    const endDate = parseMonthYear(endToken);
    return { startDate, endDate, durationText: rangeMatch[0] };
  }
  return { startDate: null, endDate: null, durationText: null };
};

const parseDate = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const normalized = parseMonthYear(value);
    if (normalized) {
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }
  }
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

const stripContact = (value = '') => {
  if (!value) return '';
  let cleaned = value;
  CONTACT_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });
  return cleaned.replace(/\s+/g, ' ').trim();
};


const cleanSummary = (value) => {
  if (typeof value !== 'string') return '';

  let cleaned = stripContact(value).trim();
  if (!cleaned) return '';

  cleaned = cleaned.replace(
    /^(professional\s+summary|summary|profile|objective)\s*[:\-–—]\s*/i,
    ''
  ).trim();

  if (!cleaned || SECTION_HEADER_EXACT.test(cleaned)) return '';

  const lineBreaks = cleaned.split(/\n/).length - 1;
  if (lineBreaks > 2 || cleaned.length > 300) {
    const firstLine = cleaned.split(/\n/)[0].trim();
    const firstSentence = firstLine.split(/[.!?]/)[0].trim();
    cleaned = firstSentence || firstLine;
  }

  return cleaned.trim();
};

const normalizeSkillTokens = (rawSkills = []) => {
  const tokens = [];
  toArray(rawSkills).forEach((entry) => {
    if (typeof entry !== 'string') return;
    entry
      .split(/[,|•·;\n]+/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => tokens.push(part));
  });

  const cleaned = [];
  tokens.forEach((token) => {
    const withoutContact = stripContact(token);
    if (!withoutContact) return;
    const normalized = withoutContact.replace(/\s+/g, ' ').trim();
    const labelSplit = normalized.split(':');
    if (labelSplit.length > 1) {
      const left = labelSplit[0].trim().toLowerCase();
      const right = labelSplit.slice(1).join(':').trim();
      if (SKILL_LABELS.has(left) && right) {
        cleaned.push(right);
        return;
      }
    }
    if (SKILL_LABELS.has(normalized.toLowerCase())) return;
    cleaned.push(normalized);
  });

  const seen = new Set();
  return cleaned.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const parseYear = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const isValidGradYear = (year) => Number.isFinite(year) && year >= 1950 && year <= 2100;

const isCourseworkOnly = (value = '') =>
  Boolean(value && COURSEWORK_ONLY.test(value) && !DEGREE_KEYWORDS.test(value));

const cleanDescription = (value = '') => {
  if (typeof value !== 'string') return undefined;
  let cleaned = stripContact(value);
  if (!cleaned) return undefined;
  const dateMatch = cleaned.match(DATE_RANGE_PATTERN);
  if (dateMatch) {
    const onlyRange = cleaned.replace(DATE_RANGE_PATTERN, '').trim();
    if (!onlyRange) {
      return dateMatch[0].trim();
    }
    cleaned = onlyRange;
  }
  if (!cleaned || cleaned.length < 3) return undefined;
  if (DATE_RANGE_PATTERN.test(cleaned)) return undefined;
  return cleaned;
};

const normalizeDateRange = (startDate, endDate) => {
  if (startDate && endDate && endDate < startDate) {
    return { startDate, endDate: undefined };
  }
  return { startDate, endDate };
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

    const descriptionText =
      typeof duration === 'string' && duration.trim()
        ? duration.trim()
        : typeof description === 'string'
          ? description.trim()
          : undefined;

    return {
      company: typeof company === 'string' ? stripContact(company.trim()) : undefined,
      role: typeof role === 'string' ? stripContact(role.trim()) : undefined,
      startDate: startDateRaw ? parseDate(startDateRaw) : undefined,
      endDate: endDateRaw ? parseDate(endDateRaw) : undefined,
      description: cleanDescription(descriptionText)
    };
  })
    .filter((entry) => entry.company && entry.role)
    .filter((entry) => !looksLikeContactOrEducation(entry.company) && !looksLikeContactOrEducation(entry.role))
    .slice(0, 5);

  // Consolidate and enrich experience: keep only company/role/location/dates, drop bullet-only rows
  const experience = rawExperience
    .map((item) => {
      let company = item.company || '';
      let role = item.role || '';
      let startDate = item.startDate;
      let endDate = item.endDate;
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

      if (!company || !role) return null;
      const normalizedDates = normalizeDateRange(startDate, endDate);

      return {
        company: stripContact(company) || '',
        role: stripContact(role) || '',
        description: cleanDescription(item.description || durationText || undefined),
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate
      };
    })
    .filter((entry) => {
      if (!entry) return false;
      // Drop bullet-style sentences
      if (VERB_LINE.test(entry.company) || VERB_LINE.test(entry.role)) return false;
      if (looksLikeContactOrEducation(entry.company) || looksLikeContactOrEducation(entry.role)) return false;
      if (!entry.company || !entry.role) return false;
      return true;
    })
    .filter((entry, index, list) => {
      const start = entry.startDate ? entry.startDate.toISOString() : '';
      const end = entry.endDate ? entry.endDate.toISOString() : '';
      const key = `${entry.company.toLowerCase()}|${entry.role.toLowerCase()}|${start}|${end}`;
      return list.findIndex((candidate) => {
        const cStart = candidate.startDate ? candidate.startDate.toISOString() : '';
        const cEnd = candidate.endDate ? candidate.endDate.toISOString() : '';
        const cKey = `${candidate.company.toLowerCase()}|${candidate.role.toLowerCase()}|${cStart}|${cEnd}`;
        return cKey === key;
      }) === index;
    })
    .slice(0, 5);

  const educationSource = pickFirst(aiPayload, ['education', 'Education', 'academics']) || [];
  const education = toArray(educationSource)
    .map((item = {}) => {
      const yearCandidate =
        parseYear(item.graduation_year) ??
        parseYear(item.graduationYear) ??
        parseYear(item.year) ??
        parseYear(item.graduation);

      const institution =
        typeof item.institution === 'string' ? stripContact(item.institution.trim()) : undefined;
      const degree = typeof item.degree === 'string' ? item.degree.trim() : undefined;
      const year = isValidGradYear(yearCandidate) ? yearCandidate : undefined;
      const degreeLooksValid = Boolean(degree && DEGREE_KEYWORDS.test(degree) && !isCourseworkOnly(degree));

      return {
        institution,
        degree: degreeLooksValid ? degree : undefined,
        year
      };
    })
    .filter((entry) => {
      if (!entry.institution || looksLikeContact(entry.institution)) return false;
      if (!entry.degree && !isValidGradYear(entry.year)) return false;
      if (entry.degree && isCourseworkOnly(entry.degree)) return false;
      return true;
    })
    .filter((entry, index, list) => {
      const key = `${entry.institution.toLowerCase()}|${(entry.degree || '').toLowerCase()}`;
      return list.findIndex((candidate) => {
        const cKey = `${candidate.institution.toLowerCase()}|${(candidate.degree || '').toLowerCase()}`;
        return cKey === key;
      }) === index;
    })
    .slice(0, 5);

  const skillsSource = pickFirst(aiPayload, ['skills', 'Skills']) || [];
  const summarySource = pickFirst(aiPayload, ['summary', 'Summary']);
  const locationSource = pickFirst(aiPayload, ['location', 'Location']);
  const summary = cleanSummary(summarySource);
  const location =
    typeof locationSource === 'string' && !looksLikeContact(locationSource)
      ? stripContact(locationSource).trim()
      : undefined;

  return {
    summary,
    skills: normalizeSkillTokens(skillsSource),
    experience,
    education,
    location,
    embeddings: toArray(aiPayload.embeddings).filter((value) => typeof value === 'number').slice(0, 2048),
    warnings: sanitizeStrings(aiPayload.warnings).map((warning) => warning.slice(0, 200)).slice(0, 10)
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


