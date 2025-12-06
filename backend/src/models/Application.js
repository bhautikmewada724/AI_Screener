import mongoose from 'mongoose';

/**
 * Stores the lifecycle of a candidate applying to a job,
 * including denormalized match data for quick HR workflows.
 */
const { Schema } = mongoose;

const applicationSchema = new Schema(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'JobDescription',
      required: true,
      index: true
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: true
    },
    matchResultId: {
      type: Schema.Types.ObjectId,
      ref: 'MatchResult'
    },
    status: {
      type: String,
      enum: ['applied', 'in_review', 'shortlisted', 'rejected', 'hired'],
      default: 'applied',
      index: true
    },
    reviewStage: {
      type: String,
      default: 'screen'
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    matchedSkills: {
      type: [String],
      default: []
    },
    matchExplanation: {
      type: Schema.Types.Mixed,
      default: null
    },
    decisionReason: String,
    notesCount: {
      type: Number,
      default: 0
    },
    metadata: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true,
    collection: 'applications'
  }
);

applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

const Application =
  mongoose.models.Application || mongoose.model('Application', applicationSchema);

export default Application;


