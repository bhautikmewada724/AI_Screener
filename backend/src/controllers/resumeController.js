import Resume from '../models/Resume.js';
import { parseResume as parseResumeAI } from '../services/aiService.js';
import { transformAiResumeToParsedData } from '../services/aiTransformers.js';
import { validateResumeFile } from '../config/multer.js';
import { scanFileForThreats } from '../utils/avScan.js';

export const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Resume file is required.' });
    }

    const validation = validateResumeFile(req.file);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    await scanFileForThreats(req.file.path);

    const resume = await Resume.create({
      userId: req.user.id,
      filePath: req.file.path,
      originalFileName: req.file.originalname,
      status: 'processing'
    });

    let parsedData = {};
    try {
      parsedData = await parseResumeAI({
        file_path: resume.filePath,
        file_name: resume.originalFileName,
        user_id: req.user.id
      });
      resume.parsedData = transformAiResumeToParsedData(parsedData);
      resume.status = 'parsed';
      resume.parsedAt = new Date();
      resume.parserVersion = 'ai-service/v1';
      if (String(process.env.TRACE_MATCHING || '').toLowerCase() === 'true') {
        console.log('[TRACE] resume parsed on upload', {
          resumeId: resume._id,
          userId: req.user.id,
          skillsCount: Array.isArray(resume.parsedData?.skills) ? resume.parsedData.skills.length : 0,
          summaryLength: resume.parsedData?.summary ? resume.parsedData.summary.length : 0
        });
      }
    } catch (error) {
      resume.status = 'failed';
      resume.parsedData = { error: error.message };
      console.error('AI parse failed:', error.message);
    }

    await resume.save();

    return res.status(201).json({
      resumeId: resume._id,
      status: resume.status,
      parsedData: resume.parsedData
    });
  } catch (error) {
    next(error);
  }
};

export const getResumeById = async (req, res, next) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found.' });
    }

    if (resume.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    return res.json(resume);
  } catch (error) {
    next(error);
  }
};

export const getMyResumes = async (req, res, next) => {
  try {
    const resumes = await Resume.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json(resumes);
  } catch (error) {
    next(error);
  }
};

