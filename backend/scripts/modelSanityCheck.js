import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDB from '../src/config/db.js';
import Resume from '../src/models/Resume.js';
import JobDescription from '../src/models/JobDescription.js';
import MatchResult from '../src/models/MatchResult.js';
import Recommendation from '../src/models/Recommendation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  try {
    await connectDB();

    const candidateId = new mongoose.Types.ObjectId();
    const hrId = new mongoose.Types.ObjectId();

    const job = await JobDescription.create({
      hrId,
      title: 'Sample Backend Engineer',
      description: 'Build APIs and collaborate with AI service.',
      requiredSkills: ['Node.js', 'MongoDB', 'FastAPI']
    });

    const resume = await Resume.create({
      userId: candidateId,
      filePath: '/uploads/sample.pdf',
      originalFileName: 'sample.pdf',
      parsedData: {
        summary: 'Backend dev with AI experience',
        skills: ['Node.js', 'FastAPI', 'MongoDB']
      },
      status: 'parsed'
    });

    const match = await MatchResult.create({
      resumeId: resume._id,
      jobId: job._id,
      matchScore: 0.82,
      matchedSkills: ['Node.js', 'MongoDB'],
      explanation: 'Skills overlap with job requirements.'
    });

    const recommendations = await Recommendation.create({
      candidateId,
      recommendedJobs: [
        { jobId: job._id, score: 0.82, rank: 1, reason: 'Highest match from sanity run.' }
      ]
    });

    console.log('✅ Created sanity documents:');
    console.table([
      { model: 'JobDescription', id: job._id.toString() },
      { model: 'Resume', id: resume._id.toString() },
      { model: 'MatchResult', id: match._id.toString() },
      { model: 'Recommendation', id: recommendations._id.toString() }
    ]);
  } catch (error) {
    console.error('❌ Sanity check failed:', error);
  } finally {
    await Promise.all([
      JobDescription.deleteMany({ title: 'Sample Backend Engineer' }),
      Resume.deleteMany({ filePath: '/uploads/sample.pdf' }),
      MatchResult.deleteMany({ explanation: 'Skills overlap with job requirements.' }),
      Recommendation.deleteMany({ 'recommendedJobs.reason': 'Highest match from sanity run.' })
    ]);
    await mongoose.connection.close();
  }
};

run();

