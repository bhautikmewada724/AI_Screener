import mongoose from 'mongoose';

const { Schema } = mongoose;

const recommendedJobSchema = new Schema(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'JobDescription',
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    rank: Number,
    reason: String
  },
  { _id: false }
);

const recommendationSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    recommendedJobs: {
      type: [recommendedJobSchema],
      default: []
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: 'recommendations'
  }
);

const Recommendation =
  mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema);

export default Recommendation;

