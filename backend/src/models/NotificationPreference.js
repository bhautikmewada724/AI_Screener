import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Per-user channel preferences. Type patterns support simple prefix matching (e.g. "project.*").
 */
const notificationPreferenceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    typePattern: {
      type: String,
      required: true,
      default: '*'
    },
    inAppEnabled: {
      type: Boolean,
      default: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    digestMode: {
      type: String,
      enum: ['none', 'instant', 'daily', 'weekly'],
      default: 'instant'
    },
    quietHours: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'notification_preferences'
  }
);

notificationPreferenceSchema.index({ userId: 1, typePattern: 1 }, { unique: true });

const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model('NotificationPreference', notificationPreferenceSchema);

export default NotificationPreference;




