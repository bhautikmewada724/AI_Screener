import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, authorizeRoles } from '../../middlewares/authMiddleware.js';
import { patchParsedData } from '../resumeController.js';
import Resume from '../../models/Resume.js';
import { ROLES } from '../../utils/roles.js';
import { getEffectiveParsedData } from '../../services/resumeCorrectionService.js';
import { transformAiResumeToParsedData } from '../../services/aiTransformers.js';

const buildRes = () => {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
};

const runChain = async (middlewares, req) => {
  const res = buildRes();
  let idx = 0;
  let nextCalled = false;
  const next = (err) => {
    if (err) throw err;
    idx += 1;
    const mw = middlewares[idx];
    if (mw) {
      return mw(req, res, next);
    }
    nextCalled = true;
    return null;
  };
  await middlewares[0](req, res, next);
  return { res, nextCalled };
};

const stubResume = (overrides = {}) => ({
  _id: 'resume-1',
  userId: { toString: () => 'user-123' },
  parsedDataCorrected: undefined,
  saveCalled: false,
  save: async function () {
    this.saveCalled = true;
    return this;
  },
  ...overrides
});

test('resume correction route rejects missing token', async () => {
  const guard = [authenticate, authorizeRoles(ROLES.CANDIDATE)];
  const { res, nextCalled } = await runChain(guard, { headers: {} });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('forbids non-owners from patching parsedData', async () => {
  const originalFind = Resume.findById;
  Resume.findById = async () => stubResume({ userId: { toString: () => 'other-user' } });

  const req = {
    params: { id: 'resume-1' },
    user: { id: 'user-123', role: ROLES.CANDIDATE },
    body: { skills: ['node'] }
  };
  const res = buildRes();

  try {
    await patchParsedData(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.message, 'Forbidden.');
  } finally {
    Resume.findById = originalFind;
  }
});

test('transformAiResumeToParsedData maps snake_case experience dates', () => {
  const parsed = transformAiResumeToParsedData({
    experience: [
      { company: 'A', role: 'Dev', start_date: '2022-01-01', end_date: '2023-01-01', description: 'desc' }
    ]
  });

  assert.equal(parsed.experience[0].company, 'A');
  assert.equal(parsed.experience[0].role, 'Dev');
  assert.ok(parsed.experience[0].startDate instanceof Date);
  assert.ok(parsed.experience[0].endDate instanceof Date);
});

test('transformAiResumeToParsedData maps alt experience keys', () => {
  const parsed = transformAiResumeToParsedData({
    Experience: [
      {
        employer: 'Haari UG',
        title: 'Backend Developer',
        start: 'Sep 2025',
        end: 'Nov 2025',
        highlights: 'Built REST APIs'
      }
    ]
  });

  assert.equal(parsed.experience[0].company, 'Haari UG');
  assert.equal(parsed.experience[0].role, 'Backend Developer');
  assert.ok(parsed.experience[0].description.includes('REST'));
});

test('returns 400 for unsupported fields', async () => {
  const originalFind = Resume.findById;
  Resume.findById = async () => stubResume();

  const req = {
    params: { id: 'resume-1' },
    user: { id: 'user-123', role: ROLES.CANDIDATE },
    body: { email: 'should-not-be-here' }
  };
  const res = buildRes();

  try {
    await patchParsedData(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.message.includes('Unsupported fields'), true);
  } finally {
    Resume.findById = originalFind;
  }
});

test('saves normalized corrections for the owner', async () => {
  const originalFind = Resume.findById;
  const resume = stubResume({ parsedData: { summary: 'Existing summary', skills: ['Old'], location: 'Oldtown' } });
  Resume.findById = async () => resume;

  const req = {
    params: { id: 'resume-1' },
    user: { id: 'user-123', role: ROLES.CANDIDATE },
    body: {
      skills: [' Node ', 'node', 'React'],
      totalYearsExperience: 4.26,
      location: '  San Francisco  '
    }
  };
  const res = buildRes();

  try {
    await patchParsedData(req, res, () => {});
    assert.equal(res.statusCode, undefined);
    assert.equal(res.body?.success, true);
    assert.deepEqual(resume.parsedDataCorrected?.skills, ['Node', 'React']);
    assert.equal(resume.parsedDataCorrected?.totalYearsExperience, 4.3);
    assert.equal(resume.parsedDataCorrected?.location, 'San Francisco');
    assert.equal(resume.isCorrected, true);
    assert.ok(resume.correctedAt instanceof Date);
    assert.equal(resume.correctedDataVersion, 'v1');
    assert.equal(resume.saveCalled, true);

    const effective = getEffectiveParsedData(resume);
    assert.equal(effective.summary, 'Existing summary'); // preserved
    assert.deepEqual(effective.skills, ['Node', 'React']); // overridden
    assert.equal(effective.location, 'San Francisco'); // overridden
  } finally {
    Resume.findById = originalFind;
  }
});

