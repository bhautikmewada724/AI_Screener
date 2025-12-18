import mongoose from 'mongoose';

const { Schema } = mongoose;

const jobDescriptionSchema = new Schema(
  {
    hrId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    location: String,
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'temporary'],
      default: 'full-time'
    },
    salaryRange: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'USD'
      }
    },
    requiredSkills: {
      type: [String],
      default: []
    },
    niceToHaveSkills: {
      type: [String],
      default: []
    },
    embeddings: {
      type: [Number],
      default: []
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'on_hold', 'closed', 'archived'],
      default: 'open',
      index: true
    },
    openings: {
      type: Number,
      default: 1,
      min: 0
    },
    tags: {
      type: [String],
      default: []
    },
    reviewStages: {
      type: [String],
      default: () => ['screen', 'interview', 'offer']
    },
    metadata: {
      type: Map,
      of: String
    },
    scoringConfig: {
      weights: {
        skills: { type: Number, min: 0, max: 100, default: 25 },
        experience: { type: Number, min: 0, max: 100, default: 25 },
        education: { type: Number, min: 0, max: 100, default: 25 },
        keywords: { type: Number, min: 0, max: 100, default: 25 }
      },
      constraints: {
        mustHaveSkills: { type: [String], default: [] },
        niceToHaveSkills: { type: [String], default: [] },
        minYearsExperience: { type: Number, default: null }
      },
      version: {
        type: Number,
        default: 0
      }
    },
    scoringConfigVersion: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'job_descriptions'
  }
);

jobDescriptionSchema.index({ title: 1 });
jobDescriptionSchema.index({ createdAt: -1 });

const JobDescription =
  mongoose.models.JobDescription || mongoose.model('JobDescription', jobDescriptionSchema);

export default JobDescription;

