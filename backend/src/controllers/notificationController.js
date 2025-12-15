import {
  emitNotification,
  getOrCreateUnsubscribeToken,
  getUnreadCount,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationsRead
} from '../services/notificationService.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { registerClient } from '../services/notificationStream.js';
import UnsubscribeToken from '../models/UnsubscribeToken.js';

const ensureUser = (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Authentication required.' });
    return false;
  }
  return true;
};

export const listNotifications = async (req, res, next) => {
  try {
    if (!ensureUser(req, res)) return;
    const { page, pageSize, unreadOnly, type, fromDate, toDate } = req.query;
    const result = await listUserNotifications({
      userId: req.user.id,
      page,
      pageSize,
      unreadOnly: unreadOnly === 'true' || unreadOnly === true,
      type,
      fromDate,
      toDate
    });
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    if (!ensureUser(req, res)) return;
    const ids = Array.isArray(req.body?.notificationIds) ? req.body.notificationIds : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'notificationIds array is required.' });
    }
    const result = await markNotificationsRead(req.user.id, ids);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    if (!ensureUser(req, res)) return;
    const result = await markAllNotificationsRead(req.user.id);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPreferences = async (req, res, next) => {
  try {
    if (!ensureUser(req, res)) return;
    const preferences = await NotificationPreference.find({ userId: req.user.id }).sort({
      typePattern: 1
    });
    return res.json({ preferences });
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req, res, next) => {
  try {
    if (!ensureUser(req, res)) return;
    const preferences = Array.isArray(req.body?.preferences) ? req.body.preferences : [];
    for (const pref of preferences) {
      if (!pref.typePattern) {
        const err = new Error('typePattern is required on each preference.');
        err.status = 400;
        throw err;
      }
      await NotificationPreference.findOneAndUpdate(
        { userId: req.user.id, typePattern: pref.typePattern },
        {
          $set: {
            inAppEnabled: pref.inAppEnabled !== false,
            emailEnabled: pref.emailEnabled !== false,
            digestMode: pref.digestMode || 'instant',
            quietHours: pref.quietHours || null
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const streamNotifications = async (req, res, next) => {
  try {
    if (!ensureUser(req, res)) return;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    registerClient({ userId: req.user.id.toString(), res });

    const unreadCount = await getUnreadCount(req.user.id);
    res.write(`event: bootstrap\ndata: ${JSON.stringify({ unreadCount })}\n\n`);
  } catch (error) {
    next(error);
  }
};

export const handleUnsubscribe = async (req, res, next) => {
  try {
    const { token, scope = 'global' } = req.query;
    if (!token) {
      return res.status(400).send('Missing token');
    }
    const record = await UnsubscribeToken.findOne({ token, scope, revokedAt: null });
    if (!record) {
      return res.status(404).send('Invalid or expired token.');
    }

    await NotificationPreference.findOneAndUpdate(
      { userId: record.userId, typePattern: '*' },
      { $set: { emailEnabled: false } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    record.revokedAt = new Date();
    await record.save({ validateBeforeSave: false });

    return res
      .status(200)
      .send('You have been unsubscribed from email notifications. You can re-enable them in your settings.');
  } catch (error) {
    next(error);
  }
};

// Utility endpoint to trigger a test notification (admin-only potential). Not exposed in routes now.
export const testEmitNotification = emitNotification;


