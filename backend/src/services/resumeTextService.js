import { createHash } from 'node:crypto';

const compact = (parts = []) => parts.filter(Boolean).map((p) => String(p).trim()).filter(Boolean);

export const buildResumeTextFromParsed = (parsedData = {}, aiRaw = {}) => {
  const direct = aiRaw.resume_text || aiRaw.resumeText || aiRaw.full_text || aiRaw.raw_text || aiRaw.rawText;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const summary = parsedData.summary || aiRaw.summary;
  const skills = Array.isArray(parsedData.skills) ? parsedData.skills.join(', ') : '';
  const experience = Array.isArray(parsedData.experience)
    ? parsedData.experience
        .map((item) => [item.role, item.company, item.description, item.duration].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' | ')
    : '';
  const education = Array.isArray(parsedData.education)
    ? parsedData.education
        .map((item) => [item.institution, item.degree, item.year].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' | ')
    : '';

  return compact([summary, skills, experience, education]).join(' · ');
};

export const computeTextFields = (text = '') => {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return {
    text: trimmed,
    textLength: trimmed.length,
    textHash: trimmed ? createHash('sha256').update(trimmed).digest('hex').slice(0, 10) : '',
    extractionError: !trimmed,
    textStatus: trimmed ? 'ok' : 'failed'
  };
};

export const ensureResumeTextFields = (resume, text, fallbackFields = {}) => {
  if (!resume) return;
  const fields = computeTextFields(text);
  resume.text = fields.text;
  resume.textLength = fields.textLength;
  resume.textHash = fields.textHash;
  resume.extractionError = fields.extractionError;
  resume.textStatus = fields.textStatus;
  if (fallbackFields && typeof fallbackFields === 'object') {
    Object.assign(resume, fallbackFields);
  }
};

