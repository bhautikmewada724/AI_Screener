import test from 'node:test';
import assert from 'node:assert/strict';

import { aiClients } from '../../services/aiService.js';
import { security } from '../../utils/avScan.js';
import { resumeExtraction } from '../../services/resumeExtractionService.js';
import Resume from '../../models/Resume.js';
import { uploadResume } from '../resumeController.js';

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

test('uploadResume stores extracted text metadata', async (t) => {
  t.mock.method(security, 'scanFileForThreats', async () => ({}));
  t.mock.method(aiClients, 'parseResume', async () => ({
    resume_text: 'Node.js, MongoDB, Express developer',
    summary: 'Backend engineer',
    skills: ['Node.js', 'MongoDB', 'Express']
  }));
  t.mock.method(resumeExtraction, 'extractResumeText', async () => 'Node.js Express MongoDB');

  let savedDoc = null;
  t.mock.method(Resume, 'create', async (payload) => {
    savedDoc = {
      ...payload,
      _id: 'r1',
      save: async () => savedDoc
    };
    return savedDoc;
  });

  const req = {
    file: {
      path: '/tmp/resume.pdf',
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      size: 1024
    },
    user: { id: 'user-1' }
  };
  const res = createMockRes();

  await uploadResume(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(res.statusCode, 201);
  assert.equal(savedDoc.textLength > 0, true);
  assert.equal(savedDoc.extractionError, false);
  assert.ok(savedDoc.textHash);
  assert.equal(res.jsonPayload.status, 'parsed');
  assert.equal(savedDoc.textStatus, 'ok');
});


