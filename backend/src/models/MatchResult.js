import mongoose from 'mongoose';

const { Schema } = mongoose;

const matchResultSchema = new Schema(
  {
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
      index: true
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'JobDescription',
      required: true,
      index: true
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    matchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    matchedSkills: {
      type: [String],
      default: []
    },
    missingSkills: {
      type: [String],
      default: []
    },
    embeddingSimilarity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    explanation: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    scoreBreakdown: {
      type: Schema.Types.Mixed,
      default: null
    },
    scoringConfigVersion: {
      type: Number,
      default: 0
    },
    trace: {
      type: Schema.Types.Mixed,
      default: null
    },
    metadata: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true,
    collection: 'match_results'
  }
);

matchResultSchema.index({ resumeId: 1, jobId: 1 }, { unique: true });
matchResultSchema.index({ jobId: 1, candidateId: 1 });

const MatchResult =
  mongoose.models.MatchResult || mongoose.model('MatchResult', matchResultSchema);

export default MatchResult;

