import test from 'node:test';
import assert from 'node:assert/strict';

import Recommendation from '../../models/Recommendation.js';
import Application from '../../models/Application.js';
import { syncAppliedJobs } from '../recommendationService.js';

const originalFind = Application.find;
const originalUpdateOne = Recommendation.updateOne;

test('syncAppliedJobs filters out applied jobs from cached recommendations', async () => {
  Application.find = async () => [{ jobId: 'job1' }];
  let updateCalled = false;
  Recommendation.updateOne = async () => {
    updateCalled = true;
    return {};
  };

  const recommendationDoc = {
    recommendedJobs: [
      { jobId: 'job1', status: 'shown', score: 0.9 },
      { jobId: 'job2', status: 'shown', score: 0.8 }
    ],
    toObject() {
      return { recommendedJobs: this.recommendedJobs };
    }
  };

  const result = await syncAppliedJobs('candidate', recommendationDoc);

  assert.equal(result.recommendedJobs.length, 1);
  assert.equal(result.recommendedJobs[0].jobId, 'job2');
  assert.equal(updateCalled, true);
});

test.after(() => {
  Application.find = originalFind;
  Recommendation.updateOne = originalUpdateOne;
});

