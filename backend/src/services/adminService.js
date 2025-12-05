import mongoose from 'mongoose';

import User from '../models/User.js';
import JobDescription from '../models/JobDescription.js';
import Application from '../models/Application.js';
import AuditEvent from '../models/AuditEvent.js';
import { ROLES } from '../utils/roles.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
  const isTargetAdmin = targetUser.role === ROLES.ADMIN && targetUser.status === 'active';
  if (!isTargetAdmin) {
    return;
  }

  const nextWillRemainAdmin = nextRole === ROLES.ADMIN && nextStatus === 'active';
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

const logAdminAction = async ({ actorId, action, context }) => {
  await AuditEvent.create({
    actorId,
    action,
    context
  });
};

export const updateUserRole = async ({ targetUserId, role, actorId }) => {
  const normalizedRole = (role || '').toLowerCase();
  if (!Object.values(ROLES).includes(normalizedRole)) {
    const error = new Error('Invalid role.');
    error.status = 400;
    throw error;
  }

  const user = await fetchUserDoc(targetUserId);
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
    context: {
      targetUserId: user._id,
      newRole: normalizedRole
    }
  });

  return sanitizeUser(user);
};

export const updateUserStatus = async ({ targetUserId, status, actorId }) => {
  const allowedStatuses = ['active', 'inactive', 'banned'];
  if (!allowedStatuses.includes(status)) {
    const error = new Error('Invalid status value.');
    error.status = 400;
    throw error;
  }

  const user = await fetchUserDoc(targetUserId);
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
    context: {
      targetUserId: user._id,
      newStatus: status
    }
  });

  return sanitizeUser(user);
};

export const getSystemOverview = async () => {
  const [totals, jobsByStatus, applicationsByStatus] = await Promise.all([
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
    ])
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
    users: userStats,
    jobs: {
      total: jobsByStatus.reduce((sum, entry) => sum + entry.count, 0),
      byStatus: jobsByStatus.reduce((acc, entry) => {
        acc[entry._id || 'unknown'] = entry.count;
        return acc;
      }, {})
    },
    applications: {
      total: applicationsByStatus.reduce((sum, entry) => sum + entry.count, 0),
      byStatus: applicationsByStatus.reduce((acc, entry) => {
        acc[entry._id || 'unknown'] = entry.count;
        return acc;
      }, {})
    }
  };
};


