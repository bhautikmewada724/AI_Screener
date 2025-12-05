import mongoose from 'mongoose';

/**
 * Lightweight collaboration artifact for HR reviewers to leave comments.
 */
const { Schema } = mongoose;

const reviewNoteSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    visibility: {
      type: String,
      enum: ['shared', 'private'],
      default: 'shared'
    }
  },
  {
    timestamps: true,
    collection: 'review_notes'
  }
);

const ReviewNote =
  mongoose.models.ReviewNote || mongoose.model('ReviewNote', reviewNoteSchema);

export default ReviewNote;


