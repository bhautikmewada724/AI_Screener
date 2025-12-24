import test from 'node:test';
import assert from 'node:assert/strict';

import { serializeRecommendation } from '../recommendationController.js';

test('serializeRecommendation omits scores and applied entries', () => {
  const doc = {
    _id: 'rec1',
    candidateId: 'cand1',
    generatedAt: new Date('2025-01-01T00:00:00Z'),
    recommendedJobs: [
      {
        jobId: { _id: 'job1', title: 'Engineer', location: 'Remote' },
        score: 0.91,
        rank: 1,
        reason: 'Strong skill overlap',
        status: 'shown',
        jobSnapshot: {
          title: 'Engineer',
          location: 'Remote',
          requiredSkills: ['ts'],
          niceToHaveSkills: []
        },
        lastRecommendedAt: new Date('2025-01-01T00:00:00Z')
      },
      {
        jobId: { _id: 'job2', title: 'Analyst' },
        score: 0.5,
        rank: 2,
        status: 'applied'
      }
    ]
  };

  const result = serializeRecommendation(doc);

  assert.equal(result.recommendedJobs.length, 1);
  const entry = result.recommendedJobs[0];
  assert.equal(entry.jobId, 'job1');
  assert.equal(entry.reason, 'Strong skill overlap');
  assert.equal(entry.status, 'shown');
  assert.equal(entry.job?.title, 'Engineer');
  assert.ok(!('score' in entry));
  assert.ok(!('rank' in entry));
});


