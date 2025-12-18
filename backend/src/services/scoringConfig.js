/**
 * Shared helpers for scoring configuration validation and defaults.
 * Keeps weights deterministic and guardrails enforced at the API boundary.
 */

export const DEFAULT_SCORING_CONFIG = Object.freeze({
  weights: {
    skills: 25,
    experience: 25,
    education: 25,
    keywords: 25
  },
  constraints: {
    mustHaveSkills: [],
    niceToHaveSkills: [],
    minYearsExperience: null
  },
  version: 0
});

const WEIGHT_KEYS = ['skills', 'experience', 'education', 'keywords'];

const ensureNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

export const normalizeWeights = (weights = {}) => {
  const normalized = {};
  WEIGHT_KEYS.forEach((key) => {
    const val = ensureNumber(weights[key]);
    normalized[key] = val === null ? DEFAULT_SCORING_CONFIG.weights[key] : val;
  });
  return normalized;
};

export const validateWeights = (weights) => {
  const entries = Object.entries(weights);

  for (const [key, value] of entries) {
    if (value < 0 || value > 100) {
      const error = new Error(`Weight "${key}" must be between 0 and 100.`);
      error.status = 400;
      throw error;
    }
  }

  const total = entries.reduce((sum, [, val]) => sum + val, 0);
  if (Math.round(total) !== 100) {
    const error = new Error('Weights must sum to 100.');
    error.status = 400;
    throw error;
  }
};

export const normalizeConstraints = (constraints = {}) => {
  const mustHaveSkills = Array.isArray(constraints.mustHaveSkills)
    ? constraints.mustHaveSkills.filter(Boolean)
    : [];
  const niceToHaveSkills = Array.isArray(constraints.niceToHaveSkills)
    ? constraints.niceToHaveSkills.filter(Boolean)
    : [];
  const minYearsExperience = ensureNumber(constraints.minYearsExperience);

  return {
    mustHaveSkills,
    niceToHaveSkills,
    minYearsExperience: minYearsExperience === null ? null : minYearsExperience
  };
};

/**
 * Returns a validated config. Throws with status 400 on invalid input.
 */
export const validateAndNormalizeScoringConfig = (input = {}) => {
  const weights = normalizeWeights(input.weights || {});
  validateWeights(weights);

  const constraints = normalizeConstraints(input.constraints || {});

  const version = typeof input.version === 'number' && Number.isFinite(input.version) ? input.version : undefined;

  return {
    weights,
    constraints,
    version
  };
};

export const mergeWithDefaults = (input = {}) => {
  const normalized = validateAndNormalizeScoringConfig(input);
  return {
    weights: { ...DEFAULT_SCORING_CONFIG.weights, ...normalized.weights },
    constraints: { ...DEFAULT_SCORING_CONFIG.constraints, ...normalized.constraints },
    version: typeof normalized.version === 'number' ? normalized.version : DEFAULT_SCORING_CONFIG.version
  };
};


