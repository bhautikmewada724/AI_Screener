import rateLimit from 'express-rate-limit';

const toMs = (minutes) => Math.max(1, Number.isFinite(minutes) ? minutes : 1) * 60 * 1000;
const intFromEnv = (key, fallback) => {
  const value = parseInt(process.env[key] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const LOGIN_RATE_LIMIT_WINDOW_MS = toMs(intFromEnv('RATE_LIMIT_LOGIN_WINDOW_MINUTES', 15));
export const LOGIN_RATE_LIMIT_MAX = intFromEnv('RATE_LIMIT_LOGIN_MAX', 5);

export const REGISTER_RATE_LIMIT_WINDOW_MS = toMs(intFromEnv('RATE_LIMIT_REGISTER_WINDOW_MINUTES', 15));
export const REGISTER_RATE_LIMIT_MAX = intFromEnv('RATE_LIMIT_REGISTER_MAX', 5);

export const RESUME_RATE_LIMIT_WINDOW_MS = toMs(intFromEnv('RATE_LIMIT_RESUME_WINDOW_MINUTES', 30));
export const RESUME_RATE_LIMIT_MAX = intFromEnv('RATE_LIMIT_RESUME_MAX', 10);

const buildLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    max: limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
    handler: (req, res) => {
      res.status(429).json({ message });
    }
  });

export const loginLimiter = buildLimiter({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX,
  message: 'Too many login attempts. Please try again later.'
});

export const registerLimiter = buildLimiter({
  windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
  limit: REGISTER_RATE_LIMIT_MAX,
  message: 'Too many registration attempts. Please try again later.'
});

export const resumeUploadLimiter = buildLimiter({
  windowMs: RESUME_RATE_LIMIT_WINDOW_MS,
  limit: RESUME_RATE_LIMIT_MAX,
  message: 'Too many resume uploads. Please slow down and try again later.'
});

