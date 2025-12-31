import Resume from '../models/Resume.js';
import { aiClients } from '../services/aiService.js';
import { transformAiResumeToParsedData } from '../services/aiTransformers.js';
import { buildResumeTextFromParsed, ensureResumeTextFields } from '../services/resumeTextService.js';
import { resumeExtraction } from '../services/resumeExtractionService.js';
import { validateResumeFile } from '../config/multer.js';
import { security } from '../utils/avScan.js';
import {
  buildCorrectionMetadata,
  validateAndNormalizeCorrections
} from '../services/resumeCorrectionService.js';

export const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Resume file is required.' });
    }

    const validation = validateResumeFile(req.file);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    await security.scanFileForThreats(req.file.path);

    const resume = await Resume.create({
      userId: req.user.id,
      filePath: req.file.path,
      originalFileName: req.file.originalname,
      status: 'processing'
    });

    let parsedData = {};
    let aiRaw = {};
    let extractedText = '';
    try {
      aiRaw = await aiClients.parseResume({
        file_path: resume.filePath,
        file_name: resume.originalFileName,
        user_id: req.user.id
      });
      resume.parsedData = transformAiResumeToParsedData(aiRaw);
      extractedText = await resumeExtraction.extractResumeText({
        filePath: resume.filePath,
        mimetype: req.file?.mimetype,
        userId: req.user.id,
        fallbackText: aiRaw?.resume_text
      });
      const resumeText = extractedText || buildResumeTextFromParsed(resume.parsedData, aiRaw);
      ensureResumeTextFields(resume, resumeText);
      resume.status = 'parsed';
      resume.parsedAt = new Date();
      resume.parserVersion = 'ai-service/v1';
      // Temporary debug logging to inspect parsed experience structure
      console.log('[DEBUG] parsedData.experience', resume.parsedData?.experience);
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
      ensureResumeTextFields(resume, '', { extractionError: true, textStatus: 'failed' });
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

export const patchParsedData = async (req, res, next) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found.' });
    }

    if (resume.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const normalized = validateAndNormalizeCorrections(req.body || {});

    resume.parsedDataCorrected = normalized;
    Object.assign(resume, buildCorrectionMetadata());

    await resume.save();

    return res.json({ success: true, resume });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

