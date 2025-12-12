import express from 'express';

import {
  getCandidateRecommendations,
  refreshCandidateRecommendations,
  submitRecommendationFeedback
} from '../controllers/recommendationController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authenticate, authorizeRoles('candidate'));

router.get('/recommendations', getCandidateRecommendations);
router.post('/recommendations/refresh', refreshCandidateRecommendations);
router.post('/recommendations/feedback', submitRecommendationFeedback);

export default router;

