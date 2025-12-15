import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import NotificationDeliveryLog from '../models/NotificationDeliveryLog.js';
import UnsubscribeToken from '../models/UnsubscribeToken.js';
import { pushToUser } from './notificationStream.js';

const DEFAULT_CHANNELS = { inApp: true, email: true };

export const matchesTypePattern = (type, pattern) => {
  if (!pattern || pattern === '*') return true;
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return type.startsWith(prefix);
  }
  return type === pattern;
};

export const resolveChannelTargets = (type, preferences = [], requested = DEFAULT_CHANNELS) => {
  const base = {
    inApp: requested?.inApp !== false,
    email: requested?.email !== false
  };

  if (!preferences.length) return base;

  // pick the most specific pattern (longest)
  const matched = preferences
    .filter((pref) => matchesTypePattern(type, pref.typePattern))
    .sort((a, b) => (b.typePattern?.length || 0) - (a.typePattern?.length || 0));

  if (!matched.length) return base;

  const preference = matched[0];
  return {
    inApp: preference.inAppEnabled !== false && base.inApp,
    email: preference.emailEnabled !== false && base.email
  };
};

export const buildIdempotencyKey = ({ type, userId, payload = {}, idempotencyKey }) => {
  if (idempotencyKey) return idempotencyKey;
  const candidate =
    payload.id ||
    payload.entityId ||
    payload.applicationId ||
    payload.jobId ||
    payload.stableId ||
    payload.deepLink;
  const stablePart = candidate || Date.now();
  return `${type}:${userId}:${stablePart}`;
};

export const serializeNotification = (doc) => ({
  id: doc._id?.toString?.(),
  type: doc.type,
  title: doc.title,
  body: doc.body,
  data: doc.data || {},
  channelTargets: doc.channelTargets || DEFAULT_CHANNELS,
  status: doc.status,
  readAt: doc.readAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

export const getOrCreateUnsubscribeToken = async (userId, scope = 'global') => {
  const existing = await UnsubscribeToken.findOne({ userId, scope, revokedAt: null });
  if (existing) return existing;
  return UnsubscribeToken.generateForUser(userId, scope);
};

export const emitNotification = async ({
  type,
  userId,
  payload = {},
  channels = DEFAULT_CHANNELS,
  idempotencyKey
}) => {
  if (!userId || !type) {
    throw new Error('userId and type are required to emit a notification.');
  }

  const preferences = await NotificationPreference.find({ userId });
  const resolvedChannels = resolveChannelTargets(type, preferences, channels);
  const computedIdempotencyKey = buildIdempotencyKey({ type, userId, payload, idempotencyKey });

  // Idempotency check: if a delivery log already exists, short-circuit.
  const existingLog = await NotificationDeliveryLog.findOne({
    idempotencyKey: computedIdempotencyKey
  });
  if (existingLog) {
    return { notification: null, deliveryLog: existingLog, idempotencyKey: computedIdempotencyKey };
  }

  let notification = null;
  if (resolvedChannels.inApp) {
    notification = await Notification.create({
      userId,
      type,
      title: payload.title || payload.subject || 'Notification',
      body: payload.body || payload.message,
      data: payload.data || payload,
      channelTargets: resolvedChannels
    });
  }

  let deliveryLog = null;
  if (resolvedChannels.email) {
    deliveryLog = await NotificationDeliveryLog.create({
      notificationId: notification?._id,
      userId,
      channel: 'email',
      idempotencyKey: computedIdempotencyKey,
      status: 'queued'
    });
  }

  if (notification) {
    const unreadCount = await Notification.countDocuments({ userId, readAt: null });
    pushToUser(userId.toString(), 'notification', {
      notification: serializeNotification(notification),
      unreadCount
    });
  }

  return { notification, deliveryLog, idempotencyKey: computedIdempotencyKey };
};

export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ userId, readAt: null });
};

export const markNotificationsRead = async (userId, notificationIds = []) => {
  const result = await Notification.updateMany(
    { _id: { $in: notificationIds }, userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  const unreadCount = await getUnreadCount(userId);
  pushToUser(userId.toString(), 'unread_count', { unreadCount });
  return { updated: result.modifiedCount, unreadCount };
};

export const markAllNotificationsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  const unreadCount = await getUnreadCount(userId);
  pushToUser(userId.toString(), 'unread_count', { unreadCount });
  return { updated: result.modifiedCount, unreadCount };
};

export const listUserNotifications = async ({
  userId,
  page = 1,
  pageSize = 20,
  unreadOnly,
  type,
  fromDate,
  toDate
}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(pageSize) || 20, 1), 100);

  const query = { userId };
  if (unreadOnly) {
    query.readAt = null;
  }
  if (type) {
    query.type = type;
  }
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) query.createdAt.$lte = new Date(toDate);
  }

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, readAt: null })
  ]);

  return {
    items: items.map(serializeNotification),
    pageInfo: {
      page: safePage,
      pageSize: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    },
    unreadCount
  };
};


