import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Application health probe.
 *     responses:
 *       200:
 *         description: Returns process uptime and timestamp.
 */
router.get('/health', getHealthStatus);

export default router;

