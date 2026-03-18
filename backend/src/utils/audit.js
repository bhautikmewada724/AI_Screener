import { createHash } from 'node:crypto';

export const isAuditEnabled = () => String(process.env.ENABLE_AUDIT_MODE || '').toLowerCase() === 'true';

export const hashText = (text) => {
  if (!text) return '';
  return createHash('sha256').update(String(text)).digest('hex').slice(0, 10);
};

export const safeSnippet = (text, maxLength = 120) => {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
};

