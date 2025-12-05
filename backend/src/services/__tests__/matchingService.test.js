import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSkillScore,
  computeExperienceScore,
  computeLocationScore,
  computeTagScore,
  clamp01
} from '../matchingService.js';

test('computeSkillScore matches overlap correctly', () => {
  const result = computeSkillScore(['Node', 'React', 'MongoDB'], ['node', 'python', 'react']);
  assert.equal(result.matchedSkills.length, 2);
  assert.equal(result.missingSkills.length, 1);
  assert.equal(result.score, 2 / 3);
});

test('computeExperienceScore increases with years', () => {
  const job = { metadata: new Map([['seniority', 'senior']]) };
  const resume = {
    parsedData: {
      experience: [
        { startDate: '2015-01-01', endDate: '2020-01-01' },
        { startDate: '2020-02-01', endDate: '2024-02-01' }
      ]
    }
  };
  const result = computeExperienceScore(job, resume);
  assert.ok(result.years > 8);
  assert.equal(result.score, 1);
});

test('computeLocationScore handles remote match', () => {
  const result = computeLocationScore({ location: 'Remote' }, { metadata: { location: 'New York' } });
  assert.equal(result.score, 1);
  assert.equal(result.match, 'match');
});

test('computeTagScore handles missing tags', () => {
  const result = computeTagScore({ tags: ['Fintech'] }, { metadata: {} });
  assert.equal(result.score, 0.5);
});

test('clamp01 bounds values', () => {
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(0.4), 0.4);
});


