import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_MIME_TYPES,
  MAX_RESUME_FILE_SIZE_BYTES,
  validateResumeFile
} from '../../config/multer.js';
import {
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  REGISTER_RATE_LIMIT_MAX,
  REGISTER_RATE_LIMIT_WINDOW_MS,
  RESUME_RATE_LIMIT_MAX,
  RESUME_RATE_LIMIT_WINDOW_MS
} from '../../middlewares/rateLimiters.js';

test('validateResumeFile allows supported mimetypes within size limit', () => {
  const file = {
    mimetype: ALLOWED_MIME_TYPES[0],
    size: MAX_RESUME_FILE_SIZE_BYTES - 1
  };
  const result = validateResumeFile(file);
  assert.equal(result.ok, true);
});

test('validateResumeFile rejects unsupported mimetype', () => {
  const file = { mimetype: 'image/png', size: 1024 };
  const result = validateResumeFile(file);
  assert.equal(result.ok, false);
  assert.ok(result.message.includes('Unsupported file type'));
});

test('validateResumeFile rejects oversized file', () => {
  const file = { mimetype: ALLOWED_MIME_TYPES[0], size: MAX_RESUME_FILE_SIZE_BYTES + 1 };
  const result = validateResumeFile(file);
  assert.equal(result.ok, false);
  assert.ok(result.message.toLowerCase().includes('file too large'));
});

test('rate limit defaults are configured', () => {
  assert.equal(LOGIN_RATE_LIMIT_MAX, 5);
  assert.equal(LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(REGISTER_RATE_LIMIT_MAX, 5);
  assert.equal(REGISTER_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(RESUME_RATE_LIMIT_MAX, 10);
  assert.equal(RESUME_RATE_LIMIT_WINDOW_MS, 30 * 60 * 1000);
});

