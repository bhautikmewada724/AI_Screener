import mongoose from 'mongoose';
import crypto from 'crypto';

const { Schema } = mongoose;

const unsubscribeTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    scope: {
      type: String,
      default: 'global'
    },
    revokedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'unsubscribe_tokens'
  }
);

unsubscribeTokenSchema.statics.generateForUser = async function (userId, scope = 'global') {
  const token = crypto.randomBytes(24).toString('hex');
  return this.create({ userId, token, scope });
};

const UnsubscribeToken =
  mongoose.models.UnsubscribeToken ||
  mongoose.model('UnsubscribeToken', unsubscribeTokenSchema);

export default UnsubscribeToken;




