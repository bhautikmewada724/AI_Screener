import { Router } from 'express';

import { getRankedMatches, simulateMatch } from '../controllers/matchingController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

/**
 * @openapi
 * /matching/jobs/{jobId}:
 *   get:
 *     tags:
 *       - AI Matching
 *     summary: Fetch FastAPI-ranked candidates for a job with explanations.
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force recomputation of scores
 *     responses:
 *       200:
 *         description: Ranked candidate matches.
 */
router.get('/jobs/:jobId', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.HR), getRankedMatches);

/**
 * @openapi
 * /matching/simulate:
 *   post:
 *     tags:
 *       - AI Matching
 *     summary: Run the local heuristic matcher for experimentation and return score/explanation.
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
 *       200:
 *         description: Matching result.
 */
router.post('/simulate', authenticate, authorizeRoles(ROLES.ADMIN), simulateMatch);

export default router;


