import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import User from '../models/User.js';
import JobDescription from '../models/JobDescription.js';
import Application from '../models/Application.js';
import AuditEvent from '../models/AuditEvent.js';
import { ROLES } from '../utils/roles.js';
import { DEFAULT_USER_STATUS, USER_STATUSES, isValidUserStatus } from '../utils/userStatus.js';

const SALT_ROUNDS = 10;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;

const mapFromMaybeMap = (value) => {
  if (!value) return undefined;
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (typeof value === 'object') {
    return { ...value };
  }
  return undefined;
};

const buildUserQuery = ({ role, status, search }) => {
  const query = {};

  if (role) {
    query.role = role;
  }

  if (status) {
    query.status = status;
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ name: regex }, { email: regex }];
  }

  return query;
};

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt
});

const fetchUserDoc = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID.');
    error.status = 400;
    throw error;
  }

  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }

  return user;
};

export const listUsers = async ({ page, limit, role, status, search }) => {
  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  if (status && !isValidUserStatus(status)) {
    const error = new Error('Invalid status filter.');
    error.status = 400;
    throw error;
  }
  const query = buildUserQuery({ role, status, search });

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .select('-passwordHash')
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    data: users.map((user) => sanitizeUser(user)),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
};

export const getUserById = async (userId) => {
  const user = await fetchUserDoc(userId);
  return sanitizeUser(user);
};

const ensureAdminSurvives = async ({ targetUser, nextRole, nextStatus }) => {
  const isTargetAdmin = targetUser.role === ROLES.ADMIN && targetUser.status === USER_STATUSES.ACTIVE;
  if (!isTargetAdmin) {
    return;
  }

  const nextWillRemainAdmin = nextRole === ROLES.ADMIN && nextStatus === USER_STATUSES.ACTIVE;
  if (nextWillRemainAdmin) {
    return;
  }

  const otherAdmins = await User.countDocuments({
    _id: { $ne: targetUser._id },
    role: ROLES.ADMIN,
    status: 'active'
  });

  if (otherAdmins === 0) {
    const error = new Error('Cannot remove the last active admin user.');
    error.status = 400;
    throw error;
  }
};

const assertNotSelfMutation = ({ actorId, targetUserId, field }) => {
  if (!actorId || !targetUserId) return;
  if (actorId.toString() === targetUserId.toString()) {
    const error = new Error(`You cannot modify your own ${field} from the admin panel.`);
    error.status = 400;
    throw error;
  }
};

const logAdminAction = async ({ actorId, action, targetUserId, before, after, context }) => {
  await AuditEvent.create({
    actorId,
    targetUserId,
    action,
    before: mapFromMaybeMap(before),
    after: mapFromMaybeMap(after),
    context: context || {}
  });
};

export const createUser = async ({ name, email, password, role, actorId }) => {
  const trimmedName = (name || '').trim();
  const normalizedEmail = (email || '').toLowerCase();
  const normalizedRole = (role || '').toLowerCase() || ROLES.CANDIDATE;

  if (!trimmedName || !normalizedEmail || !password) {
    const error = new Error('Name, email, and password are required.');
    error.status = 400;
    throw error;
  }

  if (!Object.values(ROLES).includes(normalizedRole)) {
    const error = new Error('Invalid role.');
    error.status = 400;
    throw error;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error('Email is already registered.');
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,
    status: DEFAULT_USER_STATUS
  });

  await logAdminAction({
    actorId,
    action: 'admin_user_created',
    targetUserId: user._id,
    after: { role: normalizedRole, status: DEFAULT_USER_STATUS },
    context: { targetUserId: user._id, role: normalizedRole }
  });

  return sanitizeUser(user);
};

export const updateUserRole = async ({ targetUserId, role, actorId }) => {
  const normalizedRole = (role || '').toLowerCase();
  if (!Object.values(ROLES).includes(normalizedRole)) {
    const error = new Error('Invalid role.');
    error.status = 400;
    throw error;
  }

  assertNotSelfMutation({ actorId, targetUserId, field: 'role' });

  const user = await fetchUserDoc(targetUserId);
  const previousRole = user.role;
  if (user.role === normalizedRole) {
    return sanitizeUser(user);
  }

  await ensureAdminSurvives({
    targetUser: user,
    nextRole: normalizedRole,
    nextStatus: user.status
  });

  user.role = normalizedRole;
  await user.save();

  await logAdminAction({
    actorId,
    action: 'admin_role_updated',
    targetUserId: user._id,
    before: { role: previousRole },
    after: { role: normalizedRole },
    context: {
      newRole: normalizedRole
    }
  });

  return sanitizeUser(user);
};

export const updateUserStatus = async ({ targetUserId, status, actorId }) => {
  if (!isValidUserStatus(status)) {
    const error = new Error('Invalid status value.');
    error.status = 400;
    throw error;
  }

  assertNotSelfMutation({ actorId, targetUserId, field: 'status' });

  const user = await fetchUserDoc(targetUserId);
  const previousStatus = user.status;
  if (user.status === status) {
    return sanitizeUser(user);
  }

  await ensureAdminSurvives({
    targetUser: user,
    nextRole: user.role,
    nextStatus: status
  });

  user.status = status;
  await user.save();

  await logAdminAction({
    actorId,
    action: 'admin_status_updated',
    targetUserId: user._id,
    before: { status: previousStatus },
    after: { status },
    context: {
      newStatus: status
    }
  });

  return sanitizeUser(user);
};

export const getUserAuditEvents = async ({ targetUserId, limit }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    const error = new Error('Invalid user ID.');
    error.status = 400;
    throw error;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const events = await AuditEvent.find({ targetUserId })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return events.map((event) => ({
    id: event._id.toString(),
    actorId: event.actorId?.toString(),
    targetUserId: event.targetUserId?.toString(),
    action: event.action,
    before: mapFromMaybeMap(event.before),
    after: mapFromMaybeMap(event.after),
    context: mapFromMaybeMap(event.context) || {},
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  }));
};

export const getSystemOverview = async () => {
  const now = Date.now();
  const last7Days = new Date(now - 7 * DAY);
  const last30Days = new Date(now - 30 * DAY);

  const [totals, jobsByStatus, applicationsByStatus, userRecent, jobRecent, appRecent, lastAudit] =
    await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: { role: '$role', status: '$status' },
            count: { $sum: 1 }
          }
        }
      ]),
      JobDescription.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Application.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: last7Days } } },
        { $count: 'count' }
      ]),
      JobDescription.aggregate([
        { $match: { createdAt: { $gte: last30Days } } },
        { $count: 'count' }
      ]),
      Application.aggregate([
        { $match: { createdAt: { $gte: last30Days } } },
        { $count: 'count' }
      ]),
      AuditEvent.findOne().sort({ createdAt: -1 }).select({ createdAt: 1 }).lean()
    ]);

  const userStats = totals.reduce(
    (acc, entry) => {
      const { role, status } = entry._id;
      acc.byRole[role] = (acc.byRole[role] || 0) + entry.count;
      acc.byStatus[status] = (acc.byStatus[status] || 0) + entry.count;
      acc.total += entry.count;
      return acc;
    },
    { total: 0, byRole: {}, byStatus: {} }
  );

  return {
    users: {
      ...userStats,
      createdLast7Days: userRecent[0]?.count || 0
    },
    jobs: {
      total: jobsByStatus.reduce((sum, entry) => sum + entry.count, 0),
      byStatus: jobsByStatus.reduce((acc, entry) => {
        acc[entry._id || 'unknown'] = entry.count;
        return acc;
      }, {}),
      createdLast30Days: jobRecent[0]?.count || 0
    },
    applications: {
      total: applicationsByStatus.reduce((sum, entry) => sum + entry.count, 0),
      byStatus: applicationsByStatus.reduce((acc, entry) => {
        acc[entry._id || 'unknown'] = entry.count;
        return acc;
      }, {}),
      createdLast30Days: appRecent[0]?.count || 0
    },
    health: {
      lastAuditEventAt: lastAudit?.createdAt || null
    }
  };
};


