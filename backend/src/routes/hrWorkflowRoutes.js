import { Router } from 'express';

import {
  addComment,
  getApplicationDetails,
  getJobReviewQueue,
  getScorePreview,
  listAuditTrail,
  listComments,
  refreshScore,
  updateApplicationStatus
} from '../controllers/hrWorkflowController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * /hr/jobs/{jobId}/review-queue:
 *   get:
 *     tags:
 *       - HR Workflows
 *     summary: Retrieve the candidate review queue for a job with match scores.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [applied, in_review, shortlisted, rejected, hired]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated queue payload.
 */
router.get('/jobs/:jobId/review-queue', authenticate, authorizeRoles('hr', 'admin'), getJobReviewQueue);

/**
 * @openapi
 * /hr/jobs/{jobId}/score-preview:
 *   post:
 *     tags:
 *       - HR Workflows
 *     summary: Run an AI scoring preview for a resume against a job.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resumeId
 *             properties:
 *               resumeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI match preview.
 */
router.post('/jobs/:jobId/score-preview', authenticate, authorizeRoles('hr', 'admin'), getScorePreview);

/**
 * @openapi
 * /hr/applications/{applicationId}:
 *   get:
 *     tags:
 *       - HR Workflows
 *     summary: Fetch the full application payload.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details.
 */
router.get('/applications/:applicationId', authenticate, authorizeRoles('hr', 'admin'), getApplicationDetails);

/**
 * @openapi
 * /hr/applications/{applicationId}/status:
 *   patch:
 *     tags:
 *       - HR Workflows
 *     summary: Update an application status (shortlist, reject, hire).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [applied, in_review, shortlisted, rejected, hired]
 *               reviewStage:
 *                 type: string
 *               decisionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated application.
 */
router.patch(
  '/applications/:applicationId/status',
  authenticate,
  authorizeRoles('hr', 'admin'),
  updateApplicationStatus
);

/**
 * @openapi
 * /hr/applications/{applicationId}/score-refresh:
 *   post:
 *     tags:
 *       - HR Workflows
 *     summary: Refresh AI match data for an application.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated application with new score.
 */
router.post(
  '/applications/:applicationId/score-refresh',
  authenticate,
  authorizeRoles('hr', 'admin'),
  refreshScore
);

/**
 * @openapi
 * /hr/applications/{applicationId}/comments:
 *   get:
 *     tags:
 *       - HR Workflows
 *     summary: List review notes for an application.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comments list.
 *   post:
 *     tags:
 *       - HR Workflows
 *     summary: Create a review note.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               body:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [shared, private]
 *     responses:
 *       201:
 *         description: Comment created.
 */
router
  .route('/applications/:applicationId/comments')
  .get(authenticate, authorizeRoles('hr', 'admin'), listComments)
  .post(authenticate, authorizeRoles('hr', 'admin'), addComment);

/**
 * @openapi
 * /hr/applications/{applicationId}/audit:
 *   get:
 *     tags:
 *       - HR Workflows
 *     summary: Retrieve the audit trail for an application.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit events list.
 */
router.get(
  '/applications/:applicationId/audit',
  authenticate,
  authorizeRoles('hr', 'admin'),
  listAuditTrail
);

export default router;


