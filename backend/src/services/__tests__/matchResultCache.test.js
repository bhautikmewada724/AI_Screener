import test from 'node:test';
import assert from 'node:assert/strict';

import MatchResult from '../../models/MatchResult.js';
import { clearMatchResultCache } from '../matchingService.js';

test('clearMatchResultCache deletes only the targeted match', async () => {
  const originalDeleteOne = MatchResult.deleteOne;
  let receivedFilter;
  MatchResult.deleteOne = async (filter) => {
    receivedFilter = filter;
    return { acknowledged: true, deletedCount: 1 };
  };

  try {
    const result = await clearMatchResultCache({
      jobId: 'job123',
      resumeId: 'resume456',
      requestId: 'req-1'
    });

    assert.deepEqual(receivedFilter, { jobId: 'job123', resumeId: 'resume456' });
    assert.equal(result.deletedCount, 1);
  } finally {
    MatchResult.deleteOne = originalDeleteOne;
  }
});

