import mongoose from 'mongoose';

const { Schema } = mongoose;

const unknownSkillSchema = new Schema(
  {
    phrase: { type: String, required: true, index: true, unique: true },
    rawExamples: { type: [String], default: [] },
    count: { type: Number, default: 0 },
    sources: {
      jd: { type: Number, default: 0 },
      resume: { type: Number, default: 0 }
    },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'unknown_skills' }
);

unknownSkillSchema.index({ count: -1 });

const UnknownSkill =
  mongoose.models.UnknownSkill || mongoose.model('UnknownSkill', unknownSkillSchema);

export default UnknownSkill;

