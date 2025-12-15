import dotenv from 'dotenv';

import connectDB from '../config/db.js';
import NotificationDeliveryLog from '../models/NotificationDeliveryLog.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { buildEmailContent } from '../services/emailTemplates.js';
import { sendEmail } from '../services/emailProvider.js';
import { getOrCreateUnsubscribeToken } from '../services/notificationService.js';

dotenv.config();

const POLL_MS = Number(process.env.NOTIFICATION_WORKER_POLL_MS || 5000);
const BATCH_SIZE = Number(process.env.NOTIFICATION_WORKER_BATCH || 10);
let warnedBaseUrl = false;

export const processLog = async (
  log,
  {
    send = sendEmail,
    NotificationModel = Notification,
    UserModel = User,
    getUnsubscribeToken = getOrCreateUnsubscribeToken
  } = {}
) => {
  if (!log || log.status === 'sent' || log.status === 'skipped') {
    return log;
  }

  const notification = log.notificationId
    ? await NotificationModel.findById(log.notificationId)
    : null;
  const user = await UserModel.findById(log.userId);

  if (!user || !user.email) {
    log.status = 'skipped';
    log.error = 'User email unavailable';
    await log.save({ validateBeforeSave: false });
    return log;
  }

  const unsubscribeToken = await getUnsubscribeToken(user._id);
  const baseUrl =
    process.env.API_BASE_URL ||
    process.env.APP_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  if (!warnedBaseUrl && !process.env.API_BASE_URL && !process.env.APP_BASE_URL) {
    console.warn(
      '[notification-worker] API_BASE_URL/APP_BASE_URL missing; using fallback',
      baseUrl
    );
    warnedBaseUrl = true;
  }
  const unsubscribeUrl = `${baseUrl.replace(/\/$/, '')}/api/unsubscribe?token=${unsubscribeToken.token}&scope=${unsubscribeToken.scope}`;

  const content = buildEmailContent({
    type: notification?.type || 'notification',
    payload: notification?.data || {},
    unsubscribeUrl
  });

  try {
    const info = await send({
      to: user.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers: { 'X-Notification-Id': log.notificationId?.toString?.() }
    });
    log.status = 'sent';
    log.providerMessageId = info?.messageId;
    log.error = null;
  } catch (error) {
    log.status = 'failed';
    log.error = error?.message || 'send failed';
  }

  await log.save({ validateBeforeSave: false });
  return log;
};

const processPending = async () => {
  const pending = await NotificationDeliveryLog.find({ status: { $in: ['queued', 'failed'] } })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  for (const log of pending) {
    // Double-check idempotency: if log already sent, skip.
    if (log.status === 'sent') continue;
    await processLog(log);
  }
};

export const startWorker = async () => {
  await connectDB();
  console.log('📧 Notification worker connected. Polling for queued emails...');
  await processPending();
  setInterval(processPending, POLL_MS);
};

if (process.argv[1] && process.argv[1].includes('notificationEmailWorker.js')) {
  startWorker().catch((err) => {
    console.error('Notification worker failed to start:', err);
    process.exit(1);
  });
}


