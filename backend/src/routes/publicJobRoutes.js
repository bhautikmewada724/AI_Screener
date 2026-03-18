import { Router } from 'express';

import { getPublicJobById, listPublicJobs } from '../controllers/jobController.js';

const router = Router();

/**
 * @openapi
 * /jobs:
 *   get:
 *     tags:
 *       - Public Jobs
 *     summary: List open jobs visible to candidates.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of open jobs.
 */
router.get('/', listPublicJobs);

/**
 * @openapi
 * /jobs/{jobId}:
 *   get:
 *     tags:
 *       - Public Jobs
 *     summary: Fetch a single open job visible to candidates.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job document.
 *       404:
 *         description: Job not found.
 */
router.get('/:jobId', getPublicJobById);

export default router;

