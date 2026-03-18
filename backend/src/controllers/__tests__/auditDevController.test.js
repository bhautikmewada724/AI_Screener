import test from 'node:test';
import assert from 'node:assert/strict';

import Application from '../../models/Application.js';
import JobDescription from '../../models/JobDescription.js';
import MatchResult from '../../models/MatchResult.js';
import { getMismatchChecklist } from '../auditDevController.js';

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

test('getMismatchChecklist rejects when audit mode disabled', async (t) => {
  delete process.env.ENABLE_AUDIT_MODE;
  const req = { params: { jobId: 'job-1' }, user: { id: 'user-1' } };
  const res = createMockRes();

  await getMismatchChecklist(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonPayload.message, 'Audit mode disabled.');
});

test('getMismatchChecklist returns checklist for candidate', async (t) => {
  process.env.ENABLE_AUDIT_MODE = 'true';
  t.mock.method(JobDescription, 'findById', async () => ({
    _id: 'job-1',
    requiredSkills: ['node', 'mongo'],
    scoringConfig: { weights: { skills: 50, experience: 50 } }
  }));
  t.mock.method(Application, 'findOne', async () => ({
    resumeId: 'res-1',
    matchScore: 0.52
  }));
  t.mock.method(MatchResult, 'findOne', async () => ({
    resumeId: 'res-1',
    matchScore: 0.52,
    scoreBreakdown: { finalScore: 52 }
  }));

  const req = { params: { jobId: 'job-1' }, user: { id: 'user-1' } };
  const res = createMockRes();

  await getMismatchChecklist(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.ok(res.jsonPayload?.checklist);
  assert.equal(res.jsonPayload.checklist.sameResumeIdUsedForScanAndApply, true);
  assert.equal(res.jsonPayload.checklist.requirementsCountGT0, true);
  assert.equal(res.jsonPayload.checklist.totalWeightGT0, true);
  assert.equal(res.jsonPayload.checklist.scoreIn0to100Scale, true);
  assert.equal(res.jsonPayload.checklist.applicationHasMatchScoreField, true);
  assert.equal(res.jsonPayload.checklist.UIFieldNameMatchesResponse, true);

  delete process.env.ENABLE_AUDIT_MODE;
});


