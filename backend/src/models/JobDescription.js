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
    embeddings: {
      type: [Number],
      default: []
    },
    metadata: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true,
    collection: 'job_descriptions'
  }
);

jobDescriptionSchema.index({ title: 1 });

const JobDescription =
  mongoose.models.JobDescription || mongoose.model('JobDescription', jobDescriptionSchema);

export default JobDescription;

