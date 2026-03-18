export const canonicalize = (text = '') => {
  let cleaned = String(text || '').toLowerCase();
  cleaned = cleaned.replace(/[.,/()\-]+/g, ' ');
  cleaned = cleaned.replace(/restful/g, 'rest');
  cleaned = cleaned.replace(/\bapis\b/g, 'api');
  cleaned = cleaned.replace(/\bapi\b/g, 'api');
  cleaned = cleaned.replace(/\bnode\s+js\b/g, 'nodejs');
  cleaned = cleaned.replace(/\bexpress\s+js\b/g, 'express');
  cleaned = cleaned.replace(/expressjs/g, 'express');
  cleaned = cleaned.replace(/nodejsjs/g, 'nodejs');
  cleaned = cleaned.replace(/\bjson\s+web\s+tokens?\b/g, 'jwt');
  cleaned = cleaned.replace(/\bjwt\s+token(s)?\b/g, 'jwt');
  cleaned = cleaned.replace(/\brole\s+based\s+access\s+control\b/g, 'rbac');
  cleaned = cleaned.replace(/\brole-based\s+access\s+control\b/g, 'rbac');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

export const canonicalTokens = (text = '') => canonicalize(text).split(' ').filter(Boolean);

