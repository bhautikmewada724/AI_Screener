import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Tracks per-channel delivery attempts with idempotency guarantees.
 */
const notificationDeliveryLogSchema = new Schema(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'webhook'],
      required: true
    },
    providerMessageId: {
      type: String
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued'
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'notification_delivery_logs'
  }
);

notificationDeliveryLogSchema.index({ userId: 1, createdAt: -1 });
notificationDeliveryLogSchema.index({ notificationId: 1 });

const NotificationDeliveryLog =
  mongoose.models.NotificationDeliveryLog ||
  mongoose.model('NotificationDeliveryLog', notificationDeliveryLogSchema);

export default NotificationDeliveryLog;




