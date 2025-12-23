import mongoose from 'mongoose';

const { Schema } = mongoose;

const experienceSchema = new Schema(
  {
    company: String,
    role: String,
    startDate: Date,
    endDate: Date,
    description: String
  },
  { _id: false }
);

const educationSchema = new Schema(
  {
    institution: String,
    degree: String,
    year: Number
  },
  { _id: false }
);

const parsedDataSchema = new Schema(
  {
    summary: String,
    skills: {
      type: [String],
      default: []
    },
    totalYearsExperience: {
      type: Number
    },
    experience: {
      type: [experienceSchema],
      default: []
    },
    education: {
      type: [educationSchema],
      default: []
    },
    location: {
      type: String
    },
    embeddings: {
      type: [Number],
      default: []
    },
    warnings: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const resumeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    filePath: {
      type: String,
      required: true
    },
    originalFileName: String,
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'parsed', 'failed'],
      default: 'uploaded'
    },
    parsedData: {
      type: parsedDataSchema,
      default: () => ({})
    },
    parsedDataCorrected: {
    type: Schema.Types.Mixed,
      default: undefined
    },
    isCorrected: {
      type: Boolean,
      default: false
    },
    correctedAt: {
      type: Date,
      default: null
    },
    correctedDataVersion: {
      type: String
    }
  },
  {
    timestamps: true,
    collection: 'resumes'
  }
);

resumeSchema.index({ userId: 1, createdAt: -1 });

const Resume = mongoose.models.Resume || mongoose.model('Resume', resumeSchema);

export default Resume;

