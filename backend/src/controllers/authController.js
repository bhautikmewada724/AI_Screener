import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { ALLOWED_ROLES, ROLES } from '../utils/roles.js';

const SALT_ROUNDS = 10;
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '1h';

const assertJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined. Please set it in backend/.env');
  }
};

const signToken = (user) => {
  assertJwtSecret();
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
};

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const normalizedRole = ALLOWED_ROLES.includes(role) ? role : ROLES.CANDIDATE;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: normalizedRole
    });

    const token = signToken(user);

    return res.status(201).json({
      user: sanitizeUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = signToken(user);
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res.json({
      user: sanitizeUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const adminOnlyPing = (req, res) => {
  return res.json({
    message: 'Admin access confirmed.',
    user: req.user
  });
};

