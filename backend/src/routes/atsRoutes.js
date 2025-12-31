import { Router } from 'express';

import { atsScanForJob } from '../controllers/atsScanController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

router.post(
  '/api/jobs/:jobId/ats-scan',
  authenticate,
  authorizeRoles(ROLES.CANDIDATE),
  atsScanForJob
);

export default router;

