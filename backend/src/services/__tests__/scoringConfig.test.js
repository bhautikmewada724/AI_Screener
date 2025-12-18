import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateAndNormalizeScoringConfig,
  mergeWithDefaults
} from '../scoringConfig.js';

test('validateAndNormalizeScoringConfig enforces weight sum 100', () => {
  const config = {
    weights: { skills: 40, experience: 30, education: 20, keywords: 10 },
    constraints: { mustHaveSkills: ['react'] }
  };

  const normalized = validateAndNormalizeScoringConfig(config);
  assert.equal(normalized.weights.skills, 40);
  assert.equal(normalized.constraints.mustHaveSkills[0], 'react');
});

test('validateAndNormalizeScoringConfig rejects invalid sum', () => {
  assert.throws(
    () =>
      validateAndNormalizeScoringConfig({
        weights: { skills: 10, experience: 10, education: 10, keywords: 10 }
      }),
    /Weights must sum to 100/
  );
});

test('mergeWithDefaults fills gaps', () => {
  const merged = mergeWithDefaults({
    weights: { skills: 40, experience: 20, education: 20, keywords: 20 }
  });
  assert.equal(merged.weights.skills, 40);
  assert.equal(merged.weights.experience, 20);
  assert.equal(merged.weights.education, 20);
  assert.equal(merged.weights.keywords, 20);
});

