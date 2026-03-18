import test from 'node:test';
import assert from 'node:assert/strict';

import JobDescription from '../../models/JobDescription.js';
import Resume from '../../models/Resume.js';
import * as aiService from '../../services/aiService.js';
import { atsScanForJob } from '../atsScanController.js';

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

const mockResume = {
  _id: 'res-1',
  userId: 'user-1',
  filePath: '/tmp/resume.pdf',
  originalFileName: 'resume.pdf',
  createdAt: new Date()
};

test('atsScanForJob returns ai-service response', async (t) => {
  t.mock.method(JobDescription, 'findById', async () => ({
    _id: 'job-1',
    title: 'Backend Engineer',
    description: 'Build APIs'
  }));
  t.mock.method(Resume, 'findOne', () => ({
    sort: async () => mockResume
  }));

  const aiResponse = { schemaVersion: '1.0', overall: { atsReadabilityScore: 90, keywordMatchScore: 80, evidenceScore: 70 } };
  let capturedPayload = null;
  aiService.__setAtsScanImplForTest((p) => {
    capturedPayload = p;
    return Promise.resolve(aiResponse);
  });

  const req = {
    params: { jobId: 'job-1' },
    body: {},
    headers: {},
    user: { id: 'user-1', role: 'candidate' }
  };
  const res = createMockRes();

  await atsScanForJob(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonPayload, aiResponse);
  assert.equal(capturedPayload.job_title, 'Backend Engineer');
  assert.equal(capturedPayload.file_path, '/tmp/resume.pdf');
  aiService.__setAtsScanImplForTest(undefined);
});

test('atsScanForJob returns 404 when job missing', async (t) => {
  t.mock.method(JobDescription, 'findById', async () => null);
  const req = { params: { jobId: 'missing' }, body: {}, headers: {}, user: { id: 'user-1' } };
  const res = createMockRes();

  await atsScanForJob(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.jsonPayload.message, 'Job not found.');
});

test('atsScanForJob returns 404 when resume missing', async (t) => {
  t.mock.method(JobDescription, 'findById', async () => ({ _id: 'job-1', title: 'Backend', description: 'desc' }));
  t.mock.method(Resume, 'findOne', () => ({ sort: async () => null }));
  const req = { params: { jobId: 'job-1' }, body: {}, headers: {}, user: { id: 'user-1' } };
  const res = createMockRes();

  await atsScanForJob(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.jsonPayload.message, 'Resume not found.');
});

test('atsScanForJob maps timeout to 503', async (t) => {
  t.mock.method(JobDescription, 'findById', async () => ({ _id: 'job-1', title: 'Backend', description: 'desc' }));
  t.mock.method(Resume, 'findOne', () => ({ sort: async () => mockResume }));
  aiService.__setAtsScanImplForTest(async () => {
    const err = new Error('timeout');
    err.code = 'ECONNABORTED';
    throw err;
  });

  const req = { params: { jobId: 'job-1' }, body: {}, headers: {}, user: { id: 'user-1' } };
  const res = createMockRes();

  await atsScanForJob(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 503);
  assert.equal(res.jsonPayload.message, 'AI service timeout.');
  aiService.__setAtsScanImplForTest(undefined);
});

test('atsScanForJob includes audit payload only when enabled and omits raw text', async (t) => {
  process.env.ENABLE_AUDIT_MODE = 'true';
  t.mock.method(JobDescription, 'findById', async () => ({
    _id: 'job-1',
    title: 'Backend Engineer',
    description: 'Build APIs'
  }));
  t.mock.method(Resume, 'findOne', () => ({
    sort: async () => ({ ...mockResume, _id: 'res-1' })
  }));

  const aiResponse = {
    schemaVersion: '1.1',
    requirementsCount: 3,
    overall: { atsReadabilityScore: 90, keywordMatchScore: 80, evidenceScore: 70 }
  };
  aiService.__setAtsScanImplForTest((p) => {
    return Promise.resolve(aiResponse);
  });

  const capturedLogs = [];
  const consoleMock = t.mock.method(console, 'log', (label, meta) => {
    capturedLogs.push({ label, meta });
  });

  const resumeText = 'Highly confidential resume text';
  const req = {
    params: { jobId: 'job-1' },
    body: { resumeText },
    headers: {},
    user: { id: 'user-1', role: 'candidate' }
  };
  const res = createMockRes();

  await atsScanForJob(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.ok(res.jsonPayload.audit);
  assert.equal(res.jsonPayload.audit.jobId, 'job-1');
  assert.equal(res.jsonPayload.audit.resumeId, 'res-1');
  assert.equal(res.jsonPayload.audit.requirementsCount, 3);
  assert.equal(res.jsonPayload.audit.resumeSource, 'TEXT');
  assert.equal(res.jsonPayload.audit.resumeTextLength, resumeText.length);

  const loggedPayload = JSON.stringify(capturedLogs);
  assert.ok(!loggedPayload.includes(resumeText));
  assert.ok(capturedLogs.some((entry) => entry.meta?.resumeHash));
  assert.ok(
    capturedLogs.every((entry) => entry.meta?.resumeTextLength === undefined || entry.meta?.resumeTextLength === resumeText.length)
  );

  consoleMock.mock.restore();
  aiService.__setAtsScanImplForTest(undefined);
  delete process.env.ENABLE_AUDIT_MODE;
});

