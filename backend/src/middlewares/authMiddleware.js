import jwt from 'jsonwebtoken';

import { ALLOWED_ROLES } from '../utils/roles.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

  if (!token) {
    return res.status(401).json({ message: 'Authorization token missing.' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET is not configured.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      role: decoded.role
    };
    return next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    return res.status(401).json({ message });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  const rolesToCheck = allowedRoles.length ? allowedRoles : ALLOWED_ROLES;

  return (req, res, next) => {
    if (!req.user || !rolesToCheck.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    }

    return next();
  };
};

