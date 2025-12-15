import { Router } from 'express';

import {
  getPreferences,
  handleUnsubscribe,
  listNotifications,
  markAllRead,
  markRead,
  streamNotifications,
  updatePreferences
} from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

const authenticateWithQueryToken = (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticate(req, res, next);
};

router.get('/notifications', authenticate, listNotifications);
router.post('/notifications/mark-read', authenticate, markRead);
router.post('/notifications/mark-all-read', authenticate, markAllRead);
router.get('/notification-preferences', authenticate, getPreferences);
router.put('/notification-preferences', authenticate, updatePreferences);
router.get('/notifications/stream', authenticateWithQueryToken, streamNotifications);
router.get('/unsubscribe', handleUnsubscribe);

export default router;




