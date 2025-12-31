import { Router } from 'express';

import { getMismatchChecklist } from '../controllers/auditDevController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { ROLES } from '../utils/roles.js';
import { isAuditEnabled } from '../utils/audit.js';

const router = Router();

const requireAuditMode = (req, res, next) => {
  if (!isAuditEnabled()) {
    return res.status(403).json({ message: 'Audit mode disabled.' });
  }
  return next();
};

router.get(
  '/api/dev/audit/mismatch/:jobId',
  authenticate,
  authorizeRoles(ROLES.CANDIDATE),
  requireAuditMode,
  getMismatchChecklist
);

export default router;

