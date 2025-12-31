import { aiClients } from './aiService.js';

let extractorImpl = async ({ filePath, mimetype, userId }) => {
  const aiRaw = await aiClients.parseResume({
    file_path: filePath,
    user_id: userId
  });
  return aiRaw?.resume_text || '';
};

export const extractResumeText = async ({ filePath, mimetype, userId, fallbackText }) => {
  try {
    const text = await extractorImpl({ filePath, mimetype, userId });
    if (text && text.trim()) return text.trim();
    return fallbackText || '';
  } catch (_err) {
    return fallbackText || '';
  }
};

// Test hook
export const __setExtractorImplForTest = (fn) => {
  extractorImpl = fn || extractorImpl;
};

// Mutable wrapper for easier mocking
export const resumeExtraction = {
  extractResumeText
};

