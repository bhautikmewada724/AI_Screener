const CONTROL_CHARS = /[\x00-\x08\x0E-\x1F\x7F]/g;
const ALLOWED_FIELDS = new Set(['skills', 'totalYearsExperience', 'location']);
const DEFAULT_CORRECTION_VERSION = 'v1';

const normalizeString = (value = '', { maxLength }) => {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(CONTROL_CHARS, '').trim();
  if (typeof maxLength === 'number' && maxLength > 0) {
    return cleaned.slice(0, maxLength);
  }
  return cleaned;
};

const ensureObject = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const error = new Error('Payload must be an object.');
    error.status = 400;
    throw error;
  }
};

const rejectUnknownFields = (payload) => {
  const unknown = Object.keys(payload).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) {
    const error = new Error(`Unsupported fields: ${unknown.join(', ')}`);
    error.status = 400;
    throw error;
  }
};

const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) {
    const error = new Error('skills must be an array of strings.');
    error.status = 400;
    throw error;
  }

  const deduped = [];
  const seen = new Set();

  for (const raw of skills) {
    const skill = normalizeString(raw, { maxLength: 60 });
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(skill);
    if (deduped.length >= 200) break;
  }

  return deduped;
};

const normalizeTotalYearsExperience = (value) => {
  const years = Number(value);
  if (!Number.isFinite(years)) {
    const error = new Error('totalYearsExperience must be a number.');
    error.status = 400;
    throw error;
  }
  if (years < 0 || years > 60) {
    const error = new Error('totalYearsExperience must be between 0 and 60.');
    error.status = 400;
    throw error;
  }
  return Math.round(years * 10) / 10;
};

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    const error = new Error('location must be a string.');
    error.status = 400;
    throw error;
  }
  return normalizeString(value, { maxLength: 120 });
};

/**
 * Validate and normalize a partial corrections payload.
 * Throws errors with .status when the payload is invalid.
 */
export const validateAndNormalizeCorrections = (payload = {}) => {
  ensureObject(payload);
  rejectUnknownFields(payload);

  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'skills')) {
    normalized.skills = normalizeSkills(payload.skills);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'totalYearsExperience')) {
    normalized.totalYearsExperience = normalizeTotalYearsExperience(payload.totalYearsExperience);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'location')) {
    normalized.location = normalizeLocation(payload.location);
  }

  if (!Object.keys(normalized).length) {
    const error = new Error('At least one supported field is required.');
    error.status = 400;
    throw error;
  }

  return normalized;
};

export const getEffectiveParsedData = (resume = {}) => {
  const base = resume?.parsedData || {};
  const corrected = resume?.parsedDataCorrected;

  if (corrected && typeof corrected === 'object' && Object.keys(corrected).length > 0) {
    return {
      ...base,
      ...corrected
    };
  }

  return base;
};

export const buildCorrectionMetadata = () => ({
  isCorrected: true,
  correctedAt: new Date(),
  correctedDataVersion: DEFAULT_CORRECTION_VERSION
});


