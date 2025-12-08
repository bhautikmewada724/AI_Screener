import test from 'node:test';
import assert from 'node:assert/strict';

import { transformAiResumeToParsedData, transformAiJdToJobFields } from '../aiTransformers.js';

test('transformAiResumeToParsedData normalizes casing and derived fields', () => {
  const payload = {
    summary: 'Seasoned engineer',
    skills: ['Node.js', '  ', 'React'],
    experience: [
      {
        company: 'Acme',
        role: 'Engineer',
        duration: 'Jan 2020 - Jan 2022',
        startDate: '2020-01-01',
        endDate: '2022-01-01'
      }
    ],
    education: [
      {
        institution: 'Tech University',
        degree: 'BSc',
        graduation_year: 2018
      }
    ],
    location: 'Remote',
    embeddings: [0.1, 0.2, 'ignore'],
    warnings: ['needs manual review']
  };

  const parsed = transformAiResumeToParsedData(payload);

  assert.equal(parsed.summary, 'Seasoned engineer');
  assert.deepEqual(parsed.skills, ['Node.js', 'React']);
  assert.equal(parsed.education[0].year, 2018);
  assert.equal(parsed.experience[0].description, 'Jan 2020 - Jan 2022');
  assert.equal(parsed.location, 'Remote');
  assert.deepEqual(parsed.embeddings, [0.1, 0.2]);
  assert.deepEqual(parsed.warnings, ['needs manual review']);
});

test('transformAiJdToJobFields captures metadata and optional skills', () => {
  const payload = {
    required_skills: ['Go', 'SQL'],
    nice_to_have_skills: ['GraphQL'],
    seniority_level: 'senior',
    job_category: 'backend',
    summary: 'Lead backend engineer role'
  };

  const transformed = transformAiJdToJobFields(payload);

  assert.deepEqual(transformed.requiredSkills, ['Go', 'SQL']);
  assert.deepEqual(transformed.niceToHaveSkills, ['GraphQL']);
  assert.equal(transformed.metadata.seniorityLevel, 'senior');
  assert.equal(transformed.metadata.jobCategory, 'backend');
  assert.equal(transformed.metadata.aiSummary, 'Lead backend engineer role');
});

