import { randomUUID } from 'node:crypto';
import path from 'node:path';

import JobDescription from '../models/JobDescription.js';
import Resume from '../models/Resume.js';
import { atsScan as atsScanAI } from '../services/aiService.js';
import { hashText, isAuditEnabled } from '../utils/audit.js';

const MAX_TEXT_LENGTH = 20_000;

const isTimeoutError = (error) =>
  error?.code === 'ECONNABORTED' || error?.message?.toLowerCase?.().includes('timeout');

const resolveResumeSource = (resumeText, filePath) => {
  if (resumeText) return 'TEXT';
  if (filePath) return 'FILE';
  return 'NONE';
};

const buildResumeHash = ({ resumeText, filePath, fileName }) => {
  if (resumeText) return hashText(resumeText);
  if (filePath) return hashText(filePath);
  if (fileName) return hashText(fileName);
  return '';
};

export const atsScanForJob = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const { jobId } = req.params;
  const { resumeId, resumeText } = req.body || {};
  const auditEnabled = isAuditEnabled();
  let logMeta = {
    requestId,
    jobId,
    userId: req.user?.id,
    resumeId: resumeId || null,
    jdLength: 0,
    resumeTextLength: resumeText ? resumeText.length : 0,
    resumeHash: '',
    resumeSource: resolveResumeSource(resumeText, null)
  };
  let aiStartTs = null;

  try {
    if (resumeText && resumeText.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ message: 'Resume text too large.' });
    }

    const job = await JobDescription.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const resumeQuery = resumeId ? { _id: resumeId, userId: req.user.id } : { userId: req.user.id };
    const resumeRecord = await Resume.findOne(resumeQuery).sort({ createdAt: -1 });

    if (!resumeRecord) {
      return res.status(404).json({ message: 'Resume not found.' });
    }

    const resumeFilePath = resumeRecord.filePath;
    const resolvedResumeId = resumeRecord._id?.toString();
    const resolvedFileName =
      resumeRecord.originalFileName || (resumeFilePath ? path.basename(resumeFilePath) : undefined);
    const storedResumeText = resumeRecord.text || '';
    const resolvedResumeText = resumeText || storedResumeText || null;
    const resumeSource = resolveResumeSource(resolvedResumeText, resumeFilePath);
    const resumeHash = buildResumeHash({
      resumeText: resolvedResumeText,
      filePath: resumeFilePath,
      fileName: resolvedFileName
    });

    if (!resolvedResumeText && !resumeFilePath) {
      return res.status(404).json({ message: 'Resume not found.' });
    }

    logMeta = {
      requestId,
      jobId: job._id?.toString(),
      userId: req.user?.id,
      resumeId: resolvedResumeId,
      jdLength: job.description?.length || 0,
      resumeTextLength: resolvedResumeText ? resolvedResumeText.length : 0,
      resumeHash,
      resumeSource
    };
    console.log('[ATS_SCAN][START]', logMeta);

    const aiPayload = {
      job_id: job._id?.toString(),
      resume_id: resolvedResumeId,
      job_title: job.title,
      job_description: job.description,
      file_path: resumeFilePath || null,
      file_name: resolvedFileName || null,
      resume_text: resolvedResumeText,
      user_id: req.user?.id,
      candidate_name: req.user?.name || undefined
    };

    aiStartTs = Date.now();
    const aiResponse = await atsScanAI(aiPayload, { requestId });
    const latency = Date.now() - aiStartTs;

    console.log('[ATS_SCAN][SUCCESS]', { ...logMeta, aiLatencyMs: latency });

    const requirementsCount =
      aiResponse?.requirementsCount ??
      aiResponse?.overall?.requirementsCount ??
      aiResponse?.trace?.skills?.requiredSkillsTotal;

    const responsePayload = auditEnabled
      ? {
          ...aiResponse,
          audit: {
            requestId,
            jobId: job._id?.toString(),
            resumeId: resolvedResumeId,
            jdLength: job.description?.length || 0,
            resumeTextLength: resolvedResumeText ? resolvedResumeText.length : 0,
            resumeSource,
            requirementsCount,
            schemaVersion: aiResponse?.schemaVersion
          }
        }
      : aiResponse;

    return res.json(responsePayload);
  } catch (error) {
    const latency = aiStartTs ? Date.now() - aiStartTs : undefined;
    if (isTimeoutError(error)) {
      console.error('[ATS_SCAN][TIMEOUT]', { ...logMeta, aiLatencyMs: latency, error: error.message });
      return res.status(503).json({ message: 'AI service timeout.' });
    }

    if (error?.response) {
      const status = error.response.status || 500;
      const message = error.response.data?.message || 'AI service error.';
      console.error('[ATS_SCAN][AI_ERROR]', { requestId, jobId, status, message });
      return res.status(status >= 500 ? 503 : status).json({ message });
    }

    console.error('[ATS_SCAN][ERROR]', {
      requestId,
      jobId,
      error: error.message
    });
    return next(error);
  }
};

