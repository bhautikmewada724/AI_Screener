import { Router } from 'express';

import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import {
  createJob,
  listJobs,
  getJobById,
  updateJob,
  deleteJob,
  getJobMatches
} from '../controllers/jobController.js';

const router = Router();

/**
 * @openapi
 * /hr/jobs:
 *   post:
 *     tags:
 *       - HR Jobs
 *     summary: Create a new job description.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               employmentType:
 *                 type: string
 *                 enum: [full-time, part-time, contract, internship, temporary]
 *               salaryRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                   max:
 *                     type: number
 *                   currency:
 *                     type: string
 *               requiredSkills:
 *                 type: array
 *                 items:
 *                   type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               reviewStages:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [draft, open, on_hold, closed, archived]
 *     responses:
 *       201:
 *         description: Job created.
 */
router.post('/jobs', authenticate, authorizeRoles('hr', 'admin'), createJob);

/**
 * @openapi
 * /hr/jobs:
 *   get:
 *     tags:
 *       - HR Jobs
 *     summary: List HR-owned jobs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (defaults to 1).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Page size (defaults to 10).
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive title search.
 *       - in: query
 *         name: hrId
 *         schema:
 *           type: string
 *         description: (Admin only) filter jobs by HR owner.
 */
router.get('/jobs', authenticate, authorizeRoles('hr', 'admin'), listJobs);

/**
 * @openapi
 * /hr/jobs/{jobId}:
 *   get:
 *     tags:
 *       - HR Jobs
 *     summary: Get a single job description.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job identifier.
 */
router.get('/jobs/:jobId', authenticate, authorizeRoles('hr', 'admin'), getJobById);

/**
 * @openapi
 * /hr/jobs/{jobId}:
 *   put:
 *     tags:
 *       - HR Jobs
 *     summary: Update a job description.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job identifier.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               employmentType:
 *                 type: string
 *                 enum: [full-time, part-time, contract, internship, temporary]
 *               salaryRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                   max:
 *                     type: number
 *                   currency:
 *                     type: string
 *               requiredSkills:
 *                 type: array
 *                 items:
 *                   type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               reviewStages:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [draft, open, on_hold, closed, archived]
 */
router.put('/jobs/:jobId', authenticate, authorizeRoles('hr', 'admin'), updateJob);

/**
 * @openapi
 * /hr/jobs/{jobId}:
 *   delete:
 *     tags:
 *       - HR Jobs
 *     summary: Delete a job description.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job identifier.
 */
router.delete('/jobs/:jobId', authenticate, authorizeRoles('hr', 'admin'), deleteJob);

/**
 * @openapi
 * /hr/jobs/{jobId}/matches:
 *   get:
 *     tags:
 *       - HR Jobs
 *     summary: Retrieve or generate candidate matches for a job.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force recomputation of match scores before returning results.
 */
router.get('/jobs/:jobId/matches', authenticate, authorizeRoles('hr', 'admin'), getJobMatches);

export default router;

