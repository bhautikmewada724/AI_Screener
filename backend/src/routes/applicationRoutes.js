import { Router } from 'express';

import { applyToJob, getMyApplications } from '../controllers/applicationController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * /applications:
 *   post:
 *     tags:
 *       - Applications
 *     summary: Submit a resume to a job posting.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - resumeId
 *             properties:
 *               jobId:
 *                 type: string
 *               resumeId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application created.
 *       400:
 *         description: Missing or invalid payload.
 *       401:
 *         description: Unauthorized.
 */
router.post('/', authenticate, authorizeRoles('candidate'), applyToJob);

/**
 * @openapi
 * /applications/me:
 *   get:
 *     tags:
 *       - Applications
 *     summary: List applications submitted by the authenticated candidate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Applications list.
 *       401:
 *         description: Unauthorized.
 */
router.get('/me', authenticate, authorizeRoles('candidate'), getMyApplications);

export default router;


