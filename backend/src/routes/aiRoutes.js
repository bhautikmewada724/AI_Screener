import { Router } from 'express';

import { pingAIService, parseResume } from '../services/aiService.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { ROLES } from '../utils/roles.js';

const router = Router();

/**
 * Connectivity test route. Calls the FastAPI /health endpoint.
 */
router.get('/test', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const response = await pingAIService();
    res.json({ from: 'AI service', response });
  } catch (error) {
    next(error);
  }
});

/**
 * Example route that proxies to FastAPI parse-resume endpoint with mocked payload.
 */
router.get('/sample-resume', authenticate, authorizeRoles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const response = await parseResume({
      resume_text: 'Backend engineer with Node.js and FastAPI experience.',
      candidate_name: 'Sample Candidate'
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;

