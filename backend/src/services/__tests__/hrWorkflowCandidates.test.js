import test from 'node:test';
import assert from 'node:assert/strict';

import Application from '../../models/Application.js';
import MatchResult from '../../models/MatchResult.js';
import Resume from '../../models/Resume.js';
import { getJobCandidates } from '../hrWorkflowService.js';

const mockQuery = (result) => ({
  sort: () => mockQuery(result),
  populate: () => mockQuery(result),
  select: () => mockQuery(result),
  lean: () => Promise.resolve(result),
  then: (onFulfilled) => Promise.resolve(result).then(onFulfilled)
});

test('getJobCandidates excludes applied candidates and picks best resume per candidate', async () => {
  const originalApplicationFind = Application.find;
  const originalMatchResultFind = MatchResult.find;
  const originalResumeFind = Resume.find;

  const job = {
    _id: 'job1',
    scoringConfigVersion: 3,
    scoringConfig: { weights: { skills: 25, experience: 25, education: 25, keywords: 25 }, constraints: {} }
  };

  const appliedApplications = [
    {
      _id: 'app1',
      jobId: 'job1',
      candidateId: { _id: 'cand1', name: 'Alice', email: 'alice@example.com', role: 'candidate' },
      resumeId: { _id: 'resume-applied', parsedData: { summary: 'Applied resume' } },
      status: 'applied',
      matchScore: 0.9,
      matchedSkills: ['js'],
      scoringConfigVersion: 3,
      createdAt: new Date()
    }
  ];

  const matchResults = [
    {
      _id: 'match-applied',
      jobId: 'job1',
      resumeId: 'resume-applied',
      candidateId: 'cand1',
      matchScore: 0.92,
      matchedSkills: ['js'],
      missingSkills: [],
      embeddingSimilarity: 0.8,
      explanation: {},
      scoreBreakdown: null,
      scoringConfigVersion: 3
    },
    {
      _id: 'match-cand2-low',
      jobId: 'job1',
      resumeId: 'resume-low',
      candidateId: 'cand2',
      matchScore: 0.5,
      matchedSkills: ['python'],
      missingSkills: [],
      embeddingSimilarity: 0.7,
      explanation: {},
      scoreBreakdown: null,
      scoringConfigVersion: 3
    },
    {
      _id: 'match-cand2-high',
      jobId: 'job1',
      resumeId: 'resume-high',
      // candidateId intentionally omitted to ensure fallback to resume.userId
      matchScore: 0.82,
      matchedSkills: ['react', 'node'],
      missingSkills: [],
      embeddingSimilarity: 0.85,
      explanation: {},
      scoreBreakdown: null,
      scoringConfigVersion: 4
    }
  ];

  const resumes = [
    { _id: 'resume-applied', userId: 'cand1', parsedData: { summary: 'Applied resume', skills: ['js'] } },
    { _id: 'resume-low', userId: 'cand2', parsedData: { summary: 'Lower score', skills: ['python'] } },
    { _id: 'resume-high', userId: 'cand2', parsedData: { summary: 'Higher score', skills: ['react', 'node'] } }
  ];

  try {
    Application.find = () => mockQuery(appliedApplications);
    MatchResult.find = async () => matchResults;
    Resume.find = () => mockQuery(resumes);

    const result = await getJobCandidates({ job, minScore: 0, limit: 10, refresh: false });

    assert.equal(result.applied.length, 1);
    assert.equal(result.suggested.length, 1);

    const suggestion = result.suggested[0];
    assert.equal(String(suggestion.candidateId), 'cand2');
    assert.equal(String(suggestion.resumeId), 'resume-high');
    assert.equal(Math.round(suggestion.matchScore * 100), 82);
    assert.deepEqual(suggestion.matchedSkills, ['react', 'node']);
    assert.equal(suggestion.scoringConfigVersion, 4);
    assert.equal(result.config.version, 3);
  } finally {
    Application.find = originalApplicationFind;
    MatchResult.find = originalMatchResultFind;
    Resume.find = originalResumeFind;
  }
});

