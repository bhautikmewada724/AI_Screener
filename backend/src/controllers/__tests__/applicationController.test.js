import test from 'node:test';
import assert from 'node:assert/strict';

import Application from '../../models/Application.js';
import JobDescription from '../../models/JobDescription.js';
import Recommendation from '../../models/Recommendation.js';
import Resume from '../../models/Resume.js';
import * as hrWorkflowService from '../../services/hrWorkflowService.js';
import * as matchingService from '../../services/matchingService.js';
import { applyToJob } from '../applicationController.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    jsonPayload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    }
  };
  return res;
};

test('applyToJob stores and returns stable match score and labels', async (t) => {
  t.mock.method(JobDescription, 'findById', async () => ({
    _id: 'job1',
    status: 'open',
    orgId: 'org1'
  }));
  t.mock.method(Resume, 'findOne', async () => ({
    _id: 'resume1',
    userId: 'user1',
    status: 'parsed',
    parsedData: { skills: ['a', 'b', 'c', 'd', 'e'] },
    filePath: '/tmp/resume.pdf',
    originalFileName: 'resume.pdf'
  }));
  t.mock.method(Application, 'findOne', async () => null);

  let createdPayload = null;
  t.mock.method(Application, 'create', async (payload) => {
    createdPayload = payload;
    return { ...payload, _id: 'app1', createdAt: new Date(), updatedAt: new Date() };
  });

  t.mock.method(hrWorkflowService, 'ensureMatchResult', async () => ({
    _id: 'match1',
    matchScore: 0.82,
    matchedSkills: ['a'],
    explanation: 'Great overlap',
    scoreBreakdown: { skills_score: 0.82 },
    scoringConfigVersion: 1
  }));
  t.mock.method(hrWorkflowService, 'recordAuditEvent', async () => {});
  t.mock.method(matchingService, 'clearMatchResultCache', async () => {});

  let recommendationUpdated = false;
  t.mock.method(Recommendation, 'updateOne', async () => {
    recommendationUpdated = true;
    return {};
  });

  const req = {
    body: { jobId: 'job1', resumeId: 'resume1' },
    user: { id: 'user1' },
    orgId: 'org1'
  };
  const res = createMockRes();

  await applyToJob(req, res, (err) => {
    throw err || new Error('Unexpected next() call');
  });

  assert.equal(res.statusCode, 201);
  assert.ok(createdPayload);
  assert.equal(createdPayload.matchScore, 0.82);
  assert.equal(createdPayload.matchLabel, 'Strong');
  assert.ok(createdPayload.matchComputedAt instanceof Date);
  assert.equal(res.jsonPayload.matchScore, 0.82);
  assert.equal(res.jsonPayload.matchLabel, 'Strong');
  assert.equal(recommendationUpdated, true);
});


