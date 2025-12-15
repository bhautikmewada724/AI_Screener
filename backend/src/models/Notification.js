import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * In-app notification payload per user.
 * Stores minimal fields and optional typed data for deep links.
 */
const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    body: {
      type: String
    },
    data: {
      type: Schema.Types.Mixed,
      default: {}
    },
    channelTargets: {
      type: Schema.Types.Mixed,
      default: { inApp: true, email: true }
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active'
    },
    readAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'notifications'
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;




