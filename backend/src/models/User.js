import mongoose from 'mongoose';
import { ALLOWED_ROLES, ROLES } from '../utils/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ALLOWED_ROLES,
      default: ROLES.CANDIDATE,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
      index: true
    },
    lastLoginAt: {
      type: Date
    }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

