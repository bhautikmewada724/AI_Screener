import path from 'path';
import fs from 'fs';

import multer from 'multer';

const uploadsDir = path.join(process.cwd(), 'uploads', 'resumes');

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const parseMaxFileSize = () => {
  const envBytes = parseInt(process.env.RESUME_MAX_FILE_BYTES || '', 10);
  if (Number.isFinite(envBytes) && envBytes > 0) return envBytes;
  const envMb = parseInt(process.env.RESUME_MAX_FILE_MB || '', 10);
  if (Number.isFinite(envMb) && envMb > 0) return envMb * 1024 * 1024;
  return 5 * 1024 * 1024; // default 5MB
};

export const MAX_RESUME_FILE_SIZE_BYTES = parseMaxFileSize();

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${req.user?.id || 'anonymous'}_${timestamp}${ext}`);
  }
});

export const validateResumeFile = (file) => {
  if (!file) {
    return { ok: false, message: 'Resume file is required.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { ok: false, message: 'Unsupported file type. Only PDF, DOC, and DOCX are allowed.' };
  }

  if (typeof file.size === 'number' && file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return { ok: false, message: `File too large. Max size is ${Math.round(MAX_RESUME_FILE_SIZE_BYTES / (1024 * 1024))}MB.` };
  }

  return { ok: true };
};

const fileFilter = (req, file, cb) => {
  const validation = validateResumeFile(file);
  if (validation.ok) {
    cb(null, true);
  } else {
    const error = new Error(validation.message);
    error.status = 400;
    cb(error);
  }
};

export const resumeUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_RESUME_FILE_SIZE_BYTES
  }
});

